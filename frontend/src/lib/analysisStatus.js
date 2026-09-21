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

/** "qwen3.5:9b" -> como mostrarlo al usuario. */
export function describeEngine(engine) {
  if (!engine) return null;
  if (engine === 'keywords') {
    return { texto: 'Clasificado por coincidencia de terminos, sin IA', esIA: false };
  }
  if (engine.startsWith('gemini')) {
    return { texto: `Clasificado por ${engine} (servicio externo)`, esIA: true };
  }
  return { texto: `Clasificado por ${engine} en tu equipo`, esIA: true };
}
