// Los estados del analisis viajan en dos formas: la API REST devuelve la
// etiqueta traducida ("preparando analisis") y los eventos SSE la clave
// ("PREPARING_ANALYSIS"). Comparar sin normalizar produce bugs silenciosos.

export const ANALYSIS_LABELS = {
  RECEIVED: 'recibido',
  PREPARING_ANALYSIS: 'preparando analisis',
  SENT_TO_ANALYZER: 'enviado al analizador',
  RECEIVED_BY_ANALYZER: 'recibido por el analizador',
  EXTRACTING_CONTENT: 'extrayendo contenido',
  ANALYZING_CONTENT: 'analizando contenido',
  RECEIVING_RESULT: 'recibiendo resultado',
  COMPLETED: 'completado',
  ERROR: 'error',
};

/** Texto que ve el usuario mientras el analisis avanza. */
export const ANALYSIS_PROGRESS_TEXT = {
  PREPARING_ANALYSIS: 'Preparando el documento y cifrandolo…',
  SENT_TO_ANALYZER: 'Enviado al analizador…',
  RECEIVED_BY_ANALYZER: 'Recibido por el analizador…',
  EXTRACTING_CONTENT: 'Extrayendo el contenido…',
  ANALYZING_CONTENT: 'Analizando con el modelo de IA…',
  RECEIVING_RESULT: 'Recibiendo el resultado…',
};

/** Estados en los que el analisis sigue en curso. */
export const ANALYSIS_IN_PROGRESS = Object.keys(ANALYSIS_PROGRESS_TEXT);

function sinAcentos(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** Devuelve siempre la CLAVE, venga una clave o una etiqueta. */
export function normalizeAnalysisStatus(status) {
  const clave = String(status || '').toUpperCase();
  if (clave in ANALYSIS_LABELS) return clave;

  const plano = sinAcentos(status);
  const encontrado = Object.entries(ANALYSIS_LABELS).find(
    ([, etiqueta]) => sinAcentos(etiqueta) === plano
  );

  return encontrado ? encontrado[0] : 'RECEIVED';
}

export function isAnalysisInProgress(status) {
  return ANALYSIS_IN_PROGRESS.includes(normalizeAnalysisStatus(status));
}

/**
 * Como presentar el motor que produjo una clasificacion.
 *
 * El color importa: una propuesta del respaldo por keywords se ve igual de
 * convincente que una del modelo -mismo subcriterio, misma confianza, misma
 * cita- pero no hubo ningun razonamiento detras. Distinguirlas de un vistazo
 * evita que alguien valide como analisis de IA algo que fue coincidencia de
 * terminos.
 */
export function describeEngine(engine) {
  if (!engine) return null;

  if (engine === 'manual') {
    return {
      texto: 'Asignado manualmente',
      clases: 'bg-steel-100 text-steel-600 border-steel-200',
      esIA: false,
    };
  }

  if (engine === 'keywords') {
    return {
      texto: 'Sin IA · coincidencia de terminos',
      detalle:
        'El modelo no estaba disponible o no devolvio un subcriterio valido, ' +
        'asi que la propuesta proviene de buscar palabras clave en el texto. ' +
        'Conviene revisarla con mas atencion.',
      clases: 'bg-amber-50 text-amber-800 border-amber-200',
      esIA: false,
    };
  }

  if (engine.startsWith('gemini')) {
    return {
      texto: `IA externa · ${engine}`,
      detalle: 'El texto del documento se envio a un servicio externo.',
      clases: 'bg-violet-50 text-violet-800 border-violet-200',
      esIA: true,
    };
  }

  return {
    texto: `IA local · ${engine}`,
    detalle: 'Procesado en el equipo propio; el documento no salio de la red.',
    clases: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    esIA: true,
  };
}
