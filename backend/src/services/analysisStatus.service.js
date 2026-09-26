export const ANALYSIS_STATUS_LABELS = {
  RECEIVED: 'recibido',
  PREPARING_ANALYSIS: 'preparando análisis',
  SENT_TO_ANALYZER: 'enviado al analizador',
  RECEIVED_BY_ANALYZER: 'recibido por el analizador',
  EXTRACTING_CONTENT: 'extrayendo contenido',
  ANALYZING_CONTENT: 'analizando contenido',
  RECEIVING_RESULT: 'recibiendo resultado',
  COMPLETED: 'completado',
  ERROR: 'error',
};

const DISPLAY_LOOKUP = Object.fromEntries(
  Object.entries(ANALYSIS_STATUS_LABELS).map(([key, label]) => [label, key])
);

export function normalizeAnalysisStatus(status) {
  const key = String(status || '').toUpperCase();
  if (key in ANALYSIS_STATUS_LABELS) return key;

  const plain = String(status || '').trim().toLowerCase();
  if (plain in DISPLAY_LOOKUP) return DISPLAY_LOOKUP[plain];

  return 'RECEIVED';
}

export function toDisplayAnalysisStatus(status) {
  const key = normalizeAnalysisStatus(status);
  return ANALYSIS_STATUS_LABELS[key] || ANALYSIS_STATUS_LABELS.RECEIVED;
}

export function normalizeVectorizationStatus(status) {
  const key = String(status || '').toUpperCase();

  if (key === 'PROCESSING') return ANALYSIS_STATUS_LABELS.PREPARING_ANALYSIS;
  if (key === 'READY') return ANALYSIS_STATUS_LABELS.COMPLETED;
  if (key === 'FAILED') return ANALYSIS_STATUS_LABELS.ERROR;
  if (key in ANALYSIS_STATUS_LABELS) return ANALYSIS_STATUS_LABELS[key];

  return ANALYSIS_STATUS_LABELS.RECEIVED;
}
