import { searchSimilarChunks } from './vector.service.js';
import { generateText, llmLabel } from './llm.service.js';

// Tope fijo de la vista previa. NO depende de las reglas de la sección
// (el "Extensión máxima: N páginas" de la CNA aplica al informe final, no a esta vista).
export const MAX_PREVIEW_WORDS = 150;
const TARGET_WORDS_HINT = 100; // se pide menos: en CPU cada palabra extra son segundos de espera
// Por debajo de esta cantidad de palabras de evidencia no se llama al modelo: con tan poco
// texto un modelo local rellena con generalidades en vez de decir que no hay base.
const MIN_EVIDENCE_WORDS = 40;
// La caché vive en memoria: se pierde al reiniciar o reconstruir el backend.
const CACHE_TTL_MS = (Number(process.env.LLM_CACHE_TTL_MINUTES) || 24 * 60) * 60 * 1000;
const previewCache = new Map();
const DEFAULT_REQUIREMENTS = {
  minSources: 1,
  maxSources: 5,
  instructions: [],
};
const BASE_SYSTEM_PROMPT = `
Eres un redactor de informes de autoevaluación para procesos de acreditación universitaria.
Redactas directamente el contenido de la sección pedida, en español, con tono formal, claro y objetivo,
en tercera persona institucional ("La institución…").
Los extractos son evidencia interna: úsalos como base de hechos, cifras y logros, pero NO describas los
documentos ni sus nombres ("el documento indica…", "según el archivo…"), NO enumeres las fuentes y NO comentes su calidad.
Cada afirmación debe poder rastrearse a un extracto. No inventes datos ni uses conocimiento externo.
La guía de la sección indica qué temas cubre, pero NO son hechos: si los extractos no tratan un tema, no lo menciones.
Si solo hay evidencia parcial, escribe únicamente lo respaldado, aunque sean una o dos oraciones.
Si los extractos no contienen nada relevante, responde exactamente: "Los documentos seleccionados no contienen información suficiente para redactar esta sección."
Si dos extractos se contradicen, omite el dato dudoso; no señales incoherencias: eso se revisa con otra herramienta.
Devuelve únicamente el texto de la sección, sin títulos ni introducciones, y termina siempre con una oración completa.
`;

/**
 * Limita a `maxWords` palabras conservando saltos de línea/párrafos.
 * Si hay que recortar, corta en el último fin de oración (si no pierde
 * demasiado texto) o agrega "…".
 */
export function limitWords(text, maxWords = MAX_PREVIEW_WORDS) {
  const source = String(text || '').trim();
  const words = [...source.matchAll(/\S+/g)];
  if (words.length <= maxWords) {
    return { text: source, wordCount: words.length, truncated: false };
  }

  const last = words[maxWords - 1];
  let cut = source.slice(0, last.index + last[0].length);
  const sentence = cut.match(/^[\s\S]*[.!?](?=\s|$)/);
  if (sentence && sentence[0].length > cut.length * 0.6) cut = sentence[0];
  else cut = `${cut.replace(/[,;:\s]+$/, '')}…`;

  return { text: cut, wordCount: [...cut.matchAll(/\S+/g)].length, truncated: true };
}

function normalizeRequirements(requirements) {
  // maxPages / dimensions / rawInstructions vienen del parser de la CNA: no son
  // reglas de generación y no deben entrar al prompt ni a la clave de caché.
  // eslint-disable-next-line no-unused-vars
  const { rawInstructions, dimensions, maxPages, ...rules } = requirements || {};
  const merged = { ...DEFAULT_REQUIREMENTS, ...rules };
  return {
    ...merged,
    minSources: Number.isInteger(merged.minSources) ? merged.minSources : DEFAULT_REQUIREMENTS.minSources,
    maxSources: Number.isInteger(merged.maxSources) ? merged.maxSources : DEFAULT_REQUIREMENTS.maxSources,
    instructions: Array.isArray(merged.instructions) ? merged.instructions : [],
  };
}

function cacheKey(section, requirements, documentIds) {
  return JSON.stringify({
    sectionId: section.id,
    sectionName: section.name,
    sectionDescription: section.description || null,
    requirements,
    documentIds: [...documentIds].sort((a, b) => a - b),
    promptVersion: 'report-preview-v4',
    llm: llmLabel(),
  });
}

function getCached(key) {
  const entry = previewCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    previewCache.delete(key);
    return null;
  }
  return { ...entry.value, cached: true };
}

export async function generateReportPreview({ section, requirements, documentIds }) {
  const normalizedRequirements = normalizeRequirements(requirements);
  if (documentIds.length < normalizedRequirements.minSources) {
    const error = new Error(`La sección requiere al menos ${normalizedRequirements.minSources} fuente(s).`);
    error.code = 'MIN_SOURCES_NOT_MET';
    throw error;
  }
  if (documentIds.length > normalizedRequirements.maxSources) {
    const error = new Error(`La sección permite como máximo ${normalizedRequirements.maxSources} fuente(s).`);
    error.code = 'MAX_SOURCES_EXCEEDED';
    throw error;
  }

  const key = cacheKey(section, normalizedRequirements, documentIds);
  const cached = getCached(key);
  if (cached) return cached;

  const query = `${section.name}. ${section.description || ''}`;
  // ~5 fragmentos en total (antes ~9): menos texto de entrada = respuesta más rápida en CPU.
  const perDocument = Math.max(2, Math.ceil(5 / documentIds.length));
  const results = await Promise.all(
    documentIds.map((documentId) => searchSimilarChunks(query, { limit: perDocument, documentId }))
  );
  const chunks = results.flat();

  if (chunks.length === 0) {
    const error = new Error('No se encontraron fragmentos indexados para los documentos seleccionados.');
    error.code = 'NO_RELEVANT_CONTENT';
    throw error;
  }

  const evidenceWords = [...new Set(chunks.map((chunk) => String(chunk.content)))]
    .reduce((total, content) => total + (content.match(/\S+/g) || []).length, 0);
  if (evidenceWords < MIN_EVIDENCE_WORDS) {
    const error = new Error('Los documentos seleccionados no tienen contenido suficiente para redactar esta sección.');
    error.code = 'NO_RELEVANT_CONTENT';
    throw error;
  }

  const sourceContext = chunks.map((chunk, index) =>
    `[Extracto ${index + 1}]\n${chunk.content}`
  ).join('\n\n');

  // Las instrucciones que el parser deriva de la descripción ya van en "Descripción": se omiten.
  const description = String(section.description || '').replace(/\s+/g, ' ');
  const extraInstructions = normalizedRequirements.instructions.filter(
    (line) => !description.includes(String(line).replace(/\s+/g, ' ').trim())
  );
  const instructions = extraInstructions.length > 0
    ? extraInstructions.join('\n- ')
    : 'Redacta una síntesis adecuada para esta sección.';

  const prompt = `
Redacta la sección "${section.name}" del informe de autoevaluación.

Temas que cubre la sección (solo guía; NO son hechos):
${section.description || 'No especificada'}

Indicaciones adicionales del usuario:
- ${instructions}

Extensión: máximo ${MAX_PREVIEW_WORDS} palabras (apunta a unas ${TARGET_WORDS_HINT}), en uno o dos párrafos.

Extractos de evidencia (uso interno; no los describas):
${sourceContext}
`;

  const generatedText = await generateText({ system: BASE_SYSTEM_PROMPT, prompt });
  const limited = limitWords(generatedText, MAX_PREVIEW_WORDS);

  const value = {
    generatedBy: llmLabel(),
    contentText: limited.text,
    wordCount: limited.wordCount,
    truncated: limited.truncated,
    maxWords: MAX_PREVIEW_WORDS,
    sources: [...new Map(chunks.map((chunk) => [chunk.documentId, {
      id: chunk.documentId,
      name: chunk.originalName,
    }])).values()],
  };
  previewCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export function clearReportPreviewCache() {
  previewCache.clear();
}