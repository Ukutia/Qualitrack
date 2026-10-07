import { searchSimilarCrossDocumentPairs } from './vector.service.js';
import { generateText, llmLabel } from './llm.service.js';

const MAX_PAIRS = 10; // en CPU cada par suma segundos de lectura y de respuesta
const MAX_FRAGMENT_CHARS = 900; // por fragmento en el prompt: mantiene bajo el consumo de tokens
// La caché vive en memoria: se pierde al reiniciar o reconstruir el backend.
const CACHE_TTL_MS = (Number(process.env.LLM_CACHE_TTL_MINUTES) || 24 * 60) * 60 * 1000;
const cache = new Map();

const SYSTEM_PROMPT = `
Eres un evaluador de coherencia documental.
Recibirás varios pares de afirmaciones (A y B). Evalúa cada par por separado, usando solo su texto y sin conocimiento externo.
Clasifica cada par como contradiction, support, neutral o unclear. Usa exactamente esas etiquetas, en inglés.
Si ambas afirmaciones dan valores distintos para el mismo dato de la misma entidad (edad, cifra, fecha, nombre) y el texto no ofrece una fecha o alcance que lo explique, clasifícalo como contradiction con needsReview en true.
Solo si el texto señala fechas o alcances distintos, clasifícalo como neutral.
La explicación debe tener como máximo 20 palabras.
Devuelve únicamente un arreglo JSON válido (aunque sea un solo par), con un objeto por par y en el mismo orden:
[{ "pair": 1, "relation": "...", "confidence": 0.0, "explanation": "...", "needsReview": true }]
`;

const UNCLEAR = {
  relation: 'unclear',
  confidence: 0,
  explanation: 'No se obtuvo un análisis para este par. Revíselo manualmente.',
  needsReview: true,
};

const normalizeRelation = (value) => {
  const s = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (s.startsWith('contradic')) return 'contradiction';
  if (s.startsWith('support') || s.startsWith('apoy')) return 'support';
  if (s.startsWith('neutral')) return 'neutral';
  return 'unclear';
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
    // Los modelos locales a veces devuelven un objeto suelto o {"results":[...]} en vez del arreglo.
    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && 'relation' in parsed
        ? [parsed]
        : Object.values(parsed ?? {}).find(Array.isArray) ?? [];
    for (const [index, item] of list.entries()) {
      const pair = Number.isInteger(item?.pair) ? item.pair : index + 1;
      byPair.set(pair, {
        relation: normalizeRelation(item?.relation),
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
  // La clave incluye el modelo y la versión del prompt: si cambian, no se reutilizan resultados viejos.
  const key = `v3|${llmLabel()}|${[...documentIds].map(Number).sort((a, b) => a - b).join(',')}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return { ...hit.value, cached: true };

  const pairs = await searchSimilarCrossDocumentPairs(documentIds, { limit: MAX_PAIRS, threshold: 0.82 });
  if (pairs.length === 0) return { analyzedPairs: 0, failedPairs: 0, results: [] };

  // UNA sola llamada para todos los pares (antes eran hasta 10): menos cuota, menos espera.
  const prompt = pairs
    .map((pair, i) => `PAR ${i + 1}\nA (${pair.originalNameA}): ${clip(pair.contentA)}\nB (${pair.originalNameB}): ${clip(pair.contentB)}`)
    .join('\n\n');

  const text = await generateText({
    system: SYSTEM_PROMPT,
    prompt: `${prompt}\n\nEvalúa los ${pairs.length} pares.`,
    maxOutputTokens: 2048,
    json: true,
  });
  console.log('[incoherence] respuesta del modelo:', text); // diagnóstico: se puede quitar luego
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
  // Si la respuesta no se pudo leer (todos los pares quedaron sin analizar), no se guarda en caché.
  if (!classifications.every((item) => item === UNCLEAR)) {
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  return value;
}

export function clearIncoherenceCache() {
  cache.clear();
}