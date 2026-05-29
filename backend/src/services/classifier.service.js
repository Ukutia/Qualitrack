// HU01 — Clasificador MOCK determinístico.
//
// No realiza llamadas externas. Cuenta coincidencias de las keywords de cada
// subcriterio dentro del texto del documento, elige el mejor subcriterio y
// construye una justificación citando el fragmento que motivó la asociación.
//
// La arquitectura deja este servicio como punto único de reemplazo: para
// usar Claude/OpenAI más adelante basta con sustituir `classifyText`.

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // quita acentos
}

/**
 * Devuelve el fragmento (oración) del texto que contiene la keyword dada.
 */
function findFragment(originalText, keyword) {
  const normText = normalize(originalText);
  const idx = normText.indexOf(normalize(keyword));
  if (idx === -1) return null;
  // Recorta una ventana alrededor de la coincidencia en el texto original.
  const start = Math.max(0, idx - 80);
  const end = Math.min(originalText.length, idx + keyword.length + 120);
  return originalText.slice(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} text  Texto extraído del documento.
 * @param {Array<{id,code,name,keywords:string[]}>} subcriteria
 * @returns {{
 *   relevant: boolean,
 *   subcriterionId: number|null,
 *   subcriterion: object|null,
 *   confidence: number,
 *   justification: string,
 *   evidenceFragment: string|null,
 *   matchedKeywords: string[]
 * }}
 */
export function classifyText(text, subcriteria) {
  const normText = normalize(text);

  let best = null;
  for (const sub of subcriteria) {
    const matched = (sub.keywords || []).filter((kw) => normText.includes(normalize(kw)));
    if (matched.length === 0) continue;
    const score = matched.length / (sub.keywords.length || 1);
    if (!best || matched.length > best.matched.length) {
      best = { sub, matched, score };
    }
  }

  if (!best) {
    return {
      relevant: false,
      subcriterionId: null,
      subcriterion: null,
      confidence: 0,
      justification:
        'No se detectaron términos asociados al Criterio 9 en el contenido del documento. ' +
        'La propuesta automática indica que el documento NO sería relevante; revíselo manualmente.',
      evidenceFragment: null,
      matchedKeywords: [],
    };
  }

  const fragment = findFragment(text, best.matched[0]);
  const confidence = Math.min(0.95, 0.4 + best.matched.length * 0.15);

  return {
    relevant: true,
    subcriterionId: best.sub.id,
    subcriterion: best.sub,
    confidence: Number(confidence.toFixed(2)),
    justification:
      `El documento contiene ${best.matched.length} término(s) asociados al subcriterio ` +
      `${best.sub.code} "${best.sub.name}": ${best.matched.join(', ')}.` +
      (fragment ? ` Fragmento detectado: "${fragment}".` : ''),
    evidenceFragment: fragment,
    matchedKeywords: best.matched,
  };
}
