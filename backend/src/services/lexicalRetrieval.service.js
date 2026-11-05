import { prisma } from '../config/prisma.js';
import { chunkText } from './chunking.service.js';
import { decryptText } from './encryption.service.js';

// Palabras funcionales que no ayudan a distinguir el tema de una sección.
// Se mantienen aquí (en vez de agregar una dependencia) porque la recuperación
// léxica es el modo económico de generación cuando los embeddings están apagados.
const STOP_WORDS = new Set([
  'a', 'al', 'algo', 'ante', 'bajo', 'cada', 'como', 'con', 'contra', 'cual',
  'cuando', 'de', 'del', 'desde', 'donde', 'dos', 'e', 'el', 'ella', 'ellas',
  'ellos', 'en', 'entre', 'era', 'es', 'esa', 'ese', 'eso', 'esta', 'este',
  'esto', 'fue', 'ha', 'hacia', 'han', 'hasta', 'hay', 'la', 'las', 'lo', 'los',
  'mas', 'mediante', 'muy', 'no', 'o', 'para', 'pero', 'por', 'que', 'se', 'segun',
  'sin', 'sobre', 'son', 'su', 'sus', 'tambien', 'tras', 'un', 'una', 'uno', 'y',
]);

function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function tokenize(text) {
  return (normalizeText(text).match(/[\p{L}\p{N}]+/gu) || [])
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function termFrequencies(tokens) {
  const frequencies = new Map();
  for (const token of tokens) frequencies.set(token, (frequencies.get(token) || 0) + 1);
  return frequencies;
}

/**
 * Ordena fragmentos con BM25 y una bonificación por cobertura temática.
 * No pretende reemplazar la similitud semántica: ofrece una selección útil y
 * barata cuando el usuario desactiva por completo el servicio de embeddings.
 */
export function rankChunksLexically(query, chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) return [];

  const queryTerms = [...new Set(tokenize(query))];
  if (queryTerms.length === 0) {
    return chunks.map((content, chunkIndex) => ({ content, chunkIndex, lexicalScore: 0 }));
  }

  const tokenizedChunks = chunks.map((content, chunkIndex) => {
    const tokens = tokenize(content);
    return { content, chunkIndex, tokens, frequencies: termFrequencies(tokens) };
  });
  const averageLength = tokenizedChunks.reduce((total, chunk) => total + chunk.tokens.length, 0)
    / Math.max(tokenizedChunks.length, 1);
  const documentFrequency = new Map(queryTerms.map((term) => [
    term,
    tokenizedChunks.filter((chunk) => chunk.frequencies.has(term)).length,
  ]));

  const k1 = 1.2;
  const b = 0.75;
  return tokenizedChunks.map((chunk) => {
    let score = 0;
    let matchedTerms = 0;
    for (const term of queryTerms) {
      const frequency = chunk.frequencies.get(term) || 0;
      if (frequency === 0) continue;
      matchedTerms += 1;
      const containingChunks = documentFrequency.get(term) || 0;
      const inverseFrequency = Math.log(
        1 + (tokenizedChunks.length - containingChunks + 0.5) / (containingChunks + 0.5)
      );
      const lengthRatio = averageLength > 0 ? chunk.tokens.length / averageLength : 1;
      score += inverseFrequency * ((frequency * (k1 + 1)) / (frequency + k1 * (1 - b + b * lengthRatio)));
    }

    // Favorece fragmentos que cubren varios conceptos de la sección y no solo
    // repiten muchas veces una única palabra.
    score += (matchedTerms / queryTerms.length) * 1.5;
    return { content: chunk.content, chunkIndex: chunk.chunkIndex, lexicalScore: score };
  }).sort((a, b) => b.lexicalScore - a.lexicalScore || a.chunkIndex - b.chunkIndex);
}

/** Recupera fragmentos relevantes de un documento sin generar embeddings. */
export async function searchRelevantChunksLexically(query, { limit = 5, documentId } = {}) {
  if (!query || !query.trim()) throw new Error('La consulta léxica no puede estar vacía.');

  const parsedDocumentId = Number(documentId);
  if (!Number.isInteger(parsedDocumentId) || parsedDocumentId <= 0) {
    throw new Error('documentId inválido');
  }
  const parsedLimit = Number.parseInt(limit, 10);
  const safeLimit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 5;

  const document = await prisma.document.findFirst({
    where: { id: parsedDocumentId, deletedAt: null },
    select: { id: true, originalName: true, extractedText: true },
  });
  if (!document) return [];

  const chunks = chunkText(decryptText(document.extractedText) || '');
  return rankChunksLexically(query, chunks).slice(0, safeLimit).map((chunk) => ({
    documentId: document.id,
    originalName: document.originalName,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
    lexicalScore: chunk.lexicalScore,
  }));
}
