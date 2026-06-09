// HU01 — Clasificador de documentos.
//
// Si GEMINI_API_KEY está configurada usa Google Gemini para analizar el texto
// y determinar a cuál subcriterio del Criterio 9 pertenece.
// Si no hay API key, cae al clasificador determinístico por keywords (modo offline).

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// ─── Fallback: clasificador determinístico por keywords ───────────────────────

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function findFragment(originalText, keyword) {
  const normText = normalize(originalText);
  const idx = normText.indexOf(normalize(keyword));
  if (idx === -1) return null;
  const start = Math.max(0, idx - 80);
  const end = Math.min(originalText.length, idx + keyword.length + 120);
  return originalText.slice(start, end).replace(/\s+/g, ' ').trim();
}

function classifyByKeywords(text, subcriteria) {
  const normText = normalize(text);
  let best = null;
  for (const sub of subcriteria) {
    const matched = (sub.keywords || []).filter((kw) => normText.includes(normalize(kw)));
    if (matched.length === 0) continue;
    if (!best || matched.length > best.matched.length) {
      best = { sub, matched };
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

// ─── Clasificador con Gemini ──────────────────────────────────────────────────

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    relevant: { type: SchemaType.BOOLEAN },
    subcriterionCode: { type: SchemaType.STRING, nullable: true },
    confidence: { type: SchemaType.NUMBER },
    justification: { type: SchemaType.STRING },
    evidenceFragment: { type: SchemaType.STRING, nullable: true },
  },
  required: ['relevant', 'confidence', 'justification'],
};

async function classifyByAI(text, subcriteria) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const subcriteriaList = subcriteria
    .map((s) => `- ${s.code}: "${s.name}"`)
    .join('\n');

  // Limita el texto para no exceder tokens innecesarios (Gemini Flash admite 1M)
  const textSample = text.length > 12000 ? text.slice(0, 12000) + '\n[...texto truncado...]' : text;

  const prompt = `Eres un experto en acreditación universitaria chilena (CNA).
Analiza el siguiente texto de un documento y determina si es evidencia relevante para el Criterio 9 "Aseguramiento de la calidad de los programas formativos".

SUBCRITERIOS DISPONIBLES:
${subcriteriaList}

TEXTO DEL DOCUMENTO:
"""
${textSample}
"""

Instrucciones:
- Si el documento es relevante para el Criterio 9, indica cuál subcriterio aplica mejor (usa el código exacto, ej: "9.1").
- Si no es relevante para ningún subcriterio, pon relevant=false y subcriterionCode=null.
- La justificación debe estar en español, ser concisa (2-3 oraciones) y explicar POR QUÉ el documento corresponde a ese subcriterio.
- El evidenceFragment debe ser una cita textual del documento (máx 200 caracteres) que respalde la decisión. Si no hay fragmento claro, pon null.
- La confianza (0.0 a 1.0) refleja qué tan claro es que el documento pertenece a ese subcriterio.`;

  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(result.response.text());

  if (!parsed.relevant) {
    return {
      relevant: false,
      subcriterionId: null,
      subcriterion: null,
      confidence: 0,
      justification: parsed.justification,
      evidenceFragment: null,
      matchedKeywords: [],
    };
  }

  const matched = subcriteria.find((s) => s.code === parsed.subcriterionCode);
  if (!matched) {
    // Gemini retornó un código que no existe — cae a keywords
    return classifyByKeywords(text, subcriteria);
  }

  return {
    relevant: true,
    subcriterionId: matched.id,
    subcriterion: matched,
    confidence: Math.min(0.99, Math.max(0, Number(parsed.confidence.toFixed(2)))),
    justification: parsed.justification,
    evidenceFragment: parsed.evidenceFragment ?? null,
    matchedKeywords: [],
  };
}

// ─── Punto de entrada principal ───────────────────────────────────────────────

/**
 * @param {string} text  Texto extraído del documento.
 * @param {Array<{id,code,name,keywords:string[]}>} subcriteria
 */
export async function classifyText(text, subcriteria) {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await classifyByAI(text, subcriteria);
    } catch (err) {
      console.warn('[classifier] Gemini falló, usando keywords como fallback:', err.message);
    }
  }
  return classifyByKeywords(text, subcriteria);
}
