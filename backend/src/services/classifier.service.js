// HU01 — Clasificador semántico de documentos.
//
// La clasificación se realiza únicamente con:
// - Qwen3-Embedding-0.6B
// - embeddings de los DocumentChunk
// - pgvector
//
// No utiliza Gemini ni ninguna API de IA externa.

import { searchSimilarChunks } from './vector.service.js';

const RESULTS_PER_SUBCRITERION = 3;


/**
 * Construye la consulta semántica que representa un subcriterio CNA.
 */
function buildSubcriterionQuery(subcriterion) {
  const parts = [
    `Evidencia documental relacionada con el subcriterio ${subcriterion.code}: ${subcriterion.name}.`,
  ];

  if (subcriterion.description) {
    parts.push(`Descripción: ${subcriterion.description}.`);
  }

  if (subcriterion.keywords?.length) {
    parts.push(
      `Conceptos asociados: ${subcriterion.keywords.join(', ')}.`
    );
  }

  if (subcriterion.acceptedEvidenceTypes?.length) {
    parts.push(
      `Tipos de evidencia esperados: ${subcriterion.acceptedEvidenceTypes.join(', ')}.`
    );
  }

  return parts.join(' ');
}


/**
 * Calcula un score considerando los 3 mejores chunks.
 *
 * Se da mayor importancia al primer resultado:
 * #1 = 60 %
 * #2 = 30 %
 * #3 = 10 %
 *
 * Si existen menos de 3 chunks, los pesos se normalizan.
 */
function calculateSemanticScore(results) {
  if (!results.length) {
    return 0;
  }

  const weights = [0.6, 0.3, 0.1];

  let weightedScore = 0;
  let totalWeight = 0;

  results.forEach((result, index) => {
    const weight = weights[index] ?? 0;

    weightedScore += result.similarity * weight;
    totalWeight += weight;
  });

  if (totalWeight === 0) {
    return 0;
  }

  return weightedScore / totalWeight;
}


/**
 * Clasifica un documento comparando sus chunks contra todos
 * los subcriterios disponibles.
 */
export async function classifyDocumentByEmbeddings(
  documentId,
  subcriteria
) {
  if (!Number.isInteger(documentId) || documentId <= 0) {
    throw new Error('documentId inválido.');
  }

  if (!Array.isArray(subcriteria) || subcriteria.length === 0) {
    throw new Error('No existen subcriterios disponibles para clasificar.');
  }

  const ranking = [];

  for (const subcriterion of subcriteria) {
    const query = buildSubcriterionQuery(subcriterion);

    const results = await searchSimilarChunks(
      query,
      {
        documentId,
        limit: RESULTS_PER_SUBCRITERION,
      }
    );

    if (results.length === 0) {
      continue;
    }

    const semanticScore = calculateSemanticScore(results);

    ranking.push({
      subcriterion,
      semanticScore,
      bestChunk: results[0],
      chunks: results,
    });
  }

  ranking.sort(
    (a, b) => b.semanticScore - a.semanticScore
  );

  if (ranking.length === 0) {
    return {
      relevant: false,
      subcriterionId: null,
      subcriterion: null,
      confidence: 0,
      justification:
        'No se encontraron fragmentos vectorizados disponibles para clasificar el documento.',
      evidenceFragment: null,
      matchedKeywords: [],
      semanticRanking: [],
    };
  }

  const best = ranking[0];

  const semanticRanking = ranking.map((item) => ({
    code: item.subcriterion.code,
    name: item.subcriterion.name,
    score: Number(item.semanticScore.toFixed(4)),
    bestChunkIndex: item.bestChunk.chunkIndex,
    bestChunkSimilarity: Number(
      item.bestChunk.similarity.toFixed(4)
    ),
  }));

  const score = Number(
    best.semanticScore.toFixed(4)
  );

  const evidenceFragment = best.bestChunk.content
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);

  return {
    // Por ahora siempre proponemos el mejor resultado.
    // El usuario sigue siendo quien valida o rechaza.
    relevant: true,

    subcriterionId: best.subcriterion.id,
    subcriterion: best.subcriterion,

    // Se conserva "confidence" por compatibilidad con el modelo actual.
    // Este valor representa similitud semántica, NO una probabilidad.
    confidence: Math.max(0, Math.min(1, score)),

    justification:
      `El documento presenta su mayor similitud semántica con el subcriterio ` +
      `${best.subcriterion.code} "${best.subcriterion.name}" ` +
      `(score semántico: ${score}). ` +
      `La propuesta fue generada mediante Qwen y comparación vectorial de los fragmentos del documento.`,

    evidenceFragment,

    matchedKeywords: [],

    semanticRanking,
  };
}