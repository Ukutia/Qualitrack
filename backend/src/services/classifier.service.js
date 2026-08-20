// HU01 — Clasificador de documentos.
//
// La clasificación se realiza EXCLUSIVAMENTE con Google Gemini (GEMINI_API_KEY).
// El antiguo clasificador de respaldo por keywords fue desactivado: si la IA no
// está configurada o falla, se lanza ClassifierError y el usuario recibe un
// mensaje explícito en lugar de una propuesta poco confiable.

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

/** Error de clasificación con mensaje apto para mostrar al usuario. */
export class ClassifierError extends Error {
  constructor(message, { status = 503, cause } = {}) {
    super(message);
    this.name = 'ClassifierError';
    this.status = status;
    if (cause) this.cause = cause;
  }
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

async function classifyByAI(text, subcriteria, criterion) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  // Los subcriterios se agrupan por nivel (1 obligatorio, 2 avanzado, 3 excelencia)
  // para que el modelo entienda la jerarquía de la matriz CNA.
  const LEVEL_TITLES = {
    1: 'NIVEL 1 — Cumplimiento obligatorio (piso mínimo para acreditar)',
    2: 'NIVEL 2 — Acreditación avanzada',
    3: 'NIVEL 3 — Excelencia',
  };
  const subcriteriaList = [1, 2, 3]
    .map((level) => {
      const ofLevel = subcriteria.filter((s) => (s.level ?? 1) === level);
      if (ofLevel.length === 0) return null;
      const lines = ofLevel
        .map((s) => {
          const evidence = (s.acceptedEvidenceTypes || []).join('; ');
          return (
            `  - ${s.code}: "${s.name}"${s.description ? `\n    Qué dice la matriz: ${s.description}` : ''}` +
            (evidence ? `\n    Evidencia típica esperada: ${evidence}` : '')
          );
        })
        .join('\n');
      return `${LEVEL_TITLES[level]}\n${lines}`;
    })
    .filter(Boolean)
    .join('\n\n');

  // Limita el texto para no exceder tokens innecesarios (Gemini Flash admite 1M)
  const textSample = text.length > 12000 ? text.slice(0, 12000) + '\n[...texto truncado...]' : text;

  const criterionDescription = criterion?.description ? `\n${criterion.description}\n` : '';

  const prompt = `Eres un par evaluador experto en acreditación universitaria chilena (CNA).
Analiza el siguiente texto de un documento y determina si es evidencia relevante para el Criterio 9 "Gestión y resultados del aseguramiento interno de la calidad", que se evalúa en tres niveles acumulativos (el Nivel 2 exige el Nivel 1 ya cumplido; el Nivel 3 exige los Niveles 1 y 2 ya cumplidos).${criterionDescription}
SUBCRITERIOS DISPONIBLES (agrupados por nivel, con la definición oficial de la matriz y la evidencia documental típica que los acredita):
${subcriteriaList}

TEXTO DEL DOCUMENTO:
"""
${textSample}
"""

Instrucciones:
- Compara el documento contra la "Evidencia típica esperada" de cada subcriterio, no solo contra el nombre: varios subcriterios comparten tema (ej. "mecanismos de calidad") pero pertenecen a niveles distintos según la madurez de la evidencia. Un decreto o política formal corresponde a Nivel 1; un manual de procedimientos o sistema de indicadores (KPI) que ya opera sobre esa política corresponde a Nivel 2; una auditoría externa o cierre histórico de brechas corresponde a Nivel 3.
- Si el documento es relevante para el Criterio 9, indica el subcriterio MÁS ESPECÍFICO cuya evidencia típica coincide con el contenido real del documento (usa el código exacto de tres segmentos, ej: "9.1.2"). No elijas un subcriterio solo por similitud temática si la evidencia concreta corresponde mejor a otro.
- Si no es relevante para ningún subcriterio, pon relevant=false y subcriterionCode=null.
- La justificación debe estar en español, ser concisa (2-3 oraciones), mencionar el subcriterio elegido y explicar POR QUÉ el contenido coincide con su evidencia típica esperada.
- El evidenceFragment debe ser una cita textual del documento (máx 200 caracteres) que respalde la decisión. Si no hay fragmento claro, pon null.
- La confianza (0.0 a 1.0) refleja qué tan clara e inequívoca es la coincidencia entre el documento y ese subcriterio específico.`;

  let parsed;
  try {
    const result = await model.generateContent(prompt);
    parsed = JSON.parse(result.response.text());
  } catch (err) {
    console.error('[classifier] Falló la clasificación con Gemini:', err.message);
    throw new ClassifierError(
      'No se pudo generar la propuesta automática: el servicio de IA no respondió correctamente. ' +
        'Inténtelo nuevamente en unos minutos o clasifique el documento manualmente.',
      { cause: err },
    );
  }

  if (!parsed.relevant) {
    return {
      relevant: false,
      subcriterionId: null,
      subcriterion: null,
      confidence: 0,
      justification: parsed.justification,
      evidenceFragment: null,
    };
  }

  const matched = subcriteria.find((s) => s.code === parsed.subcriterionCode);
  if (!matched) {
    console.error('[classifier] Gemini devolvió un subcriterio inexistente:', parsed.subcriterionCode);
    throw new ClassifierError(
      'No se pudo generar la propuesta automática: la IA devolvió un subcriterio que no existe ' +
        'en el Criterio 9. Inténtelo nuevamente o clasifique el documento manualmente.',
    );
  }

  return {
    relevant: true,
    subcriterionId: matched.id,
    subcriterion: matched,
    confidence: Math.min(0.99, Math.max(0, Number(parsed.confidence.toFixed(2)))),
    justification: parsed.justification,
    evidenceFragment: parsed.evidenceFragment ?? null,
  };
}

// ─── Punto de entrada principal ───────────────────────────────────────────────

/**
 * @param {string} text  Texto extraído del documento.
 * @param {Array<{id,code,name,level,description,acceptedEvidenceTypes}>} subcriteria
 * @param {{name,description}} [criterion]  Contexto del Criterio 9 (opcional).
 * @throws {ClassifierError} si la IA no está configurada, falla o no hay texto que analizar.
 */
export async function classifyText(text, subcriteria, criterion) {
  if (!process.env.GEMINI_API_KEY) {
    throw new ClassifierError(
      'La clasificación automática no está disponible: falta configurar la clave del servicio de IA ' +
        '(GEMINI_API_KEY). Contacte al administrador del sistema.',
    );
  }

  if (!text || !text.trim()) {
    throw new ClassifierError(
      'No se pudo generar la propuesta automática: el documento no tiene texto extraído para analizar ' +
        '(puede ser un PDF escaneado o un archivo vacío).',
      { status: 422 },
    );
  }

  if (!subcriteria || subcriteria.length === 0) {
    throw new ClassifierError(
      'No se pudo generar la propuesta automática: no hay subcriterios configurados para el Criterio 9.',
      { status: 422 },
    );
  }

  return classifyByAI(text, subcriteria, criterion);
}
