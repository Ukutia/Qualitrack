import { searchSimilarCrossDocumentPairs } from './vector.service.js';
import { generateWithGemini } from './gemini.service.js';

const MAX_PAIRS = 10;
const MAX_FRAGMENT_CHARS = 900; // por fragmento en el prompt: mantiene bajo el consumo de tokens
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map();

const SYSTEM_PROMPT = `
Eres un evaluador de coherencia documental.
Recibirás varios pares de afirmaciones (A y B). Evalúa cada par por separado, usando solo su texto y sin conocimiento externo.
Clasifica cada par como contradiction, support, neutral o unclear.
Una diferencia temporal o de alcance no es contradicción automáticamente.
Devuelve únicamente un arreglo JSON válido, con un objeto por par y en el mismo orden:
[{ "pair": 1, "relation": "...", "confidence": 0.0, "explanation": "...", "needsReview": true }]
`;

const RELATIONS = ['contradiction', 'support', 'neutral', 'unclear'];
const UNCLEAR = {
  relation: 'unclear',
  confidence: 0,
  explanation: 'No se obtuvo un análisis para este par. Revíselo manualmente.',
  needsReview: true,
};

const clip = (text) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > MAX_FRAGMENT_CHARS ? `${clean.slice(0, MAX_FRAGMENT_CHARS)}…` : clean;
};

/** Devuelve un arreglo de resultados alineado con los pares (índice = número de par - 1). */
function parseResults(text, count) {
  const raw = String(text || '').replace(/^```json\s*|\s*```$/g, '').trim();
  const byPair = new Map();
  try {
    const parsed = JSON.parse(raw);
    for (const [index, item] of (Array.isArray(parsed) ? parsed : []).entries()) {
      const pair = Number.isInteger(item?.pair) ? item.pair : index + 1;
      byPair.set(pair, {
        relation: RELATIONS.includes(item?.relation) ? item.relation : 'unclear',
        confidence: Math.min(Math.max(Number(item?.confidence) || 0, 0), 1),
        explanation: String(item?.explanation || 'Se requiere revisión humana.'),
        needsReview: item?.needsReview !== false,
      });
    }
  } catch {
    // Respuesta no interpretable: todos los pares quedan para revisión humana.
  }
  return Array.from({ length: count }, (_, i) => byPair.get(i + 1) ?? UNCLEAR);
}

export async function detectDocumentIncoherences(documentIds) {
  const key = [...documentIds].map(Number).sort((a, b) => a - b).join(',');
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return { ...hit.value, cached: true };

  const pairs = await searchSimilarCrossDocumentPairs(documentIds, { limit: MAX_PAIRS, threshold: 0.82 });
  if (pairs.length === 0) return { analyzedPairs: 0, failedPairs: 0, results: [] };

  // UNA sola llamada para todos los pares (antes eran hasta 10): menos cuota, menos espera.
  const prompt = pairs
    .map((pair, i) => `PAR ${i + 1}\nA (${pair.originalNameA}): ${clip(pair.contentA)}\nB (${pair.originalNameB}): ${clip(pair.contentB)}`)
    .join('\n\n');

  const text = await generateWithGemini({
    system: SYSTEM_PROMPT,
    prompt: `${prompt}\n\nEvalúa los ${pairs.length} pares.`,
    maxOutputTokens: 2048,
    json: true,
  });
  const classifications = parseResults(text, pairs.length);

  const value = {
    analyzedPairs: pairs.length,
    failedPairs: 0,
    results: pairs.map((pair, i) => ({
      ...classifications[i],
      similarity: pair.similarity,
      sourceA: { documentId: pair.documentIdA, name: pair.originalNameA, fragment: pair.contentA },
      sourceB: { documentId: pair.documentIdB, name: pair.originalNameB, fragment: pair.contentB },
    })),
  };
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export function clearIncoherenceCache() {
  cache.clear();
}