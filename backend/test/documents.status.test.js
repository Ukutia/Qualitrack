import { describe, expect, it } from 'vitest';
import {
  normalizeVectorizationStatus,
  ANALYSIS_STATUS_LABELS,
} from '../src/services/analysisStatus.service.js';

describe('normalizeVectorizationStatus', () => {
  it('mapea exactamente los estados del flujo de análisis a los nombres de interfaz requeridos', () => {
    expect(normalizeVectorizationStatus('RECEIVED')).toBe('recibido');
    expect(normalizeVectorizationStatus('PREPARING_ANALYSIS')).toBe('preparando análisis');
    expect(normalizeVectorizationStatus('SENT_TO_ANALYZER')).toBe('enviado al analizador');
    expect(normalizeVectorizationStatus('RECEIVED_BY_ANALYZER')).toBe('recibido por el analizador');
    expect(normalizeVectorizationStatus('EXTRACTING_CONTENT')).toBe('extrayendo contenido');
    expect(normalizeVectorizationStatus('ANALYZING_CONTENT')).toBe('analizando contenido');
    expect(normalizeVectorizationStatus('RECEIVING_RESULT')).toBe('recibiendo resultado');
    expect(normalizeVectorizationStatus('COMPLETED')).toBe('completado');
    expect(normalizeVectorizationStatus('ERROR')).toBe('error');
  });

  it('mantiene el conjunto completo de etiquetas publicadas por el sistema', () => {
    expect(ANALYSIS_STATUS_LABELS).toEqual({
      RECEIVED: 'recibido',
      PREPARING_ANALYSIS: 'preparando análisis',
      SENT_TO_ANALYZER: 'enviado al analizador',
      RECEIVED_BY_ANALYZER: 'recibido por el analizador',
      EXTRACTING_CONTENT: 'extrayendo contenido',
      ANALYZING_CONTENT: 'analizando contenido',
      RECEIVING_RESULT: 'recibiendo resultado',
      COMPLETED: 'completado',
      ERROR: 'error',
    });
  });
});
