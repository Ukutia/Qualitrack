// HU01 — Clasificador de documentos.
//
// Determina a cuál subcriterio del Criterio 9 pertenece un documento.
// El proveedor se elige con CLASSIFIER_PROVIDER:
//
//   local    LLM propio vía Ollama (por defecto). Los documentos nunca salen
//            de la red: es la opción que sostiene el requisito de privacidad.
//   gemini   Google Gemini. Requiere GEMINI_API_KEY y envía el texto a Google.
//   keywords Clasificador determinístico, sin IA.
//
// Cualquier proveedor que falle cae a keywords, de modo que la carga de
// documentos nunca se bloquea por un servicio de IA caído.

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { generateStructured } from './llm.service.js';

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

// ─── Prompt y esquema compartidos por los proveedores de IA ───────────────────

// subcriterionCode va en `required` a propósito. Bajo una gramática que
// restringe la salida (tanto Ollama como Gemini), un campo opcional
// sencillamente se omite: sin esto el modelo devuelve JSON válido pero sin el
// código, y la búsqueda del subcriterio cae siempre al fallback de keywords.
const REQUIRED_FIELDS = [
  'relevant',
  'subcriterionCode',
  'confidence',
  'justification',
];

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    relevant: { type: SchemaType.BOOLEAN },
    subcriterionCode: { type: SchemaType.STRING, nullable: true },
    confidence: { type: SchemaType.NUMBER },
    justification: { type: SchemaType.STRING },
    evidenceFragment: { type: SchemaType.STRING, nullable: true },
  },
  required: REQUIRED_FIELDS,
};

// Mismo contrato en JSON Schema estándar, que es lo que entiende Ollama.
const LOCAL_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    relevant: { type: 'boolean' },
    subcriterionCode: { type: ['string', 'null'] },
    confidence: { type: 'number' },
    justification: { type: 'string' },
    evidenceFragment: { type: ['string', 'null'] },
  },
  required: REQUIRED_FIELDS,
};

// Limita el texto para no gastar contexto de más.
function sampleText(text) {
  return text.length > 12000
    ? text.slice(0, 12000) + '\n[...texto truncado...]'
    : text;
}

function buildInstructions(subcriteria) {
  // La descripción es decisiva: los nombres por sí solos ("Monitoreo del
  // desempeño" vs "Institucionalidad de la calidad") no bastan para separar
  // subcriterios vecinos del mismo nivel.
  const subcriteriaList = subcriteria
    .map((s) =>
      s.description
        ? `- ${s.code} "${s.name}": ${s.description}`
        : `- ${s.code}: "${s.name}"`
    )
    .join('\n');

  return `Eres un experto en acreditación universitaria chilena (CNA).
Analizas documentos y determinas si son evidencia relevante para el Criterio 9 "Aseguramiento de la calidad de los programas formativos".

SUBCRITERIOS DISPONIBLES:
${subcriteriaList}

Instrucciones:
- Si el documento es relevante para el Criterio 9, indica cuál subcriterio aplica mejor (usa el código exacto, ej: "9.1").
- Si no es relevante para ningún subcriterio, pon relevant=false y subcriterionCode=null.
- La justificación debe estar en español, ser concisa (2-3 oraciones) y explicar POR QUÉ el documento corresponde a ese subcriterio.
- El evidenceFragment debe ser una cita textual y literal del documento (máx 200 caracteres) que respalde la decisión. Cópiala del texto, no la parafrasees. Solo pon null si el documento no es relevante.
- La confianza (0.0 a 1.0) refleja qué tan claro es que el documento pertenece a ese subcriterio.`;
}

/**
 * Convierte la respuesta cruda del modelo al contrato que espera el controlador.
 * Compartida por ambos proveedores para que un cambio de motor no altere la
 * forma del resultado.
 */
function toResult(parsed, text, subcriteria) {
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
    // El modelo devolvió un código inexistente — cae a keywords.
    return classifyByKeywords(text, subcriteria);
  }

  // Un modelo local puede omitir la cita aunque el esquema la permita;
  // en ese caso se recupera del propio texto.
  const evidenceFragment =
    parsed.evidenceFragment ??
    findFragment(text, matched.keywords?.[0] || matched.name);

  return {
    relevant: true,
    subcriterionId: matched.id,
    subcriterion: matched,
    confidence: Math.min(0.99, Math.max(0, Number(parsed.confidence.toFixed(2)))),
    justification: parsed.justification,
    evidenceFragment,
    matchedKeywords: [],
  };
}

// ─── Clasificador con LLM local (Ollama) ──────────────────────────────────────

async function classifyByLocalLLM(text, subcriteria) {
  const parsed = await generateStructured({
    system: buildInstructions(subcriteria),
    user: `TEXTO DEL DOCUMENTO:\n"""\n${sampleText(text)}\n"""\n\nDetermina si es evidencia relevante para el Criterio 9 y cuál subcriterio aplica mejor.`,
    schema: LOCAL_RESPONSE_SCHEMA,
  });

  return toResult(parsed, text, subcriteria);
}

// ─── Clasificador con Gemini ──────────────────────────────────────────────────

async function classifyByAI(text, subcriteria) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: buildInstructions(subcriteria),
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const prompt = `TEXTO DEL DOCUMENTO:
"""
${sampleText(text)}
"""

Determina si es evidencia relevante para el Criterio 9 y cual subcriterio aplica mejor.`;

  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(result.response.text());

  return toResult(parsed, text, subcriteria);
}

// ─── Punto de entrada principal ──────────────────────────────────────

const PROVIDERS = {
  local: classifyByLocalLLM,
  gemini: classifyByAI,
};

/**
 * Elige el proveedor. Por defecto "local": la IA propia es el camino normal y
 * Gemini queda como opcion explicita, no como el default silencioso.
 */
function resolveProvider() {
  const configured = (process.env.CLASSIFIER_PROVIDER || '').toLowerCase();

  if (configured) return configured;

  // Compatibilidad con despliegues previos que solo definian la API key.
  return process.env.GEMINI_API_KEY ? 'gemini' : 'local';
}

/**
 * @param {string} text  Texto extraido del documento.
 * @param {Array<{id,code,name,keywords:string[]}>} subcriteria
 */
export async function classifyText(text, subcriteria) {
  const provider = resolveProvider();
  const classify = PROVIDERS[provider];

  if (classify) {
    try {
      return await classify(text, subcriteria);
    } catch (err) {
      console.warn(
        `[classifier] El proveedor "${provider}" fallo, usando keywords como fallback:`,
        err.message
      );
    }
  } else if (provider !== 'keywords') {
    console.warn(
      `[classifier] CLASSIFIER_PROVIDER="${provider}" no es valido. Usa local, gemini o keywords.`
    );
  }

  return classifyByKeywords(text, subcriteria);
}

export { classifyByKeywords, classifyByLocalLLM, classifyByAI };
