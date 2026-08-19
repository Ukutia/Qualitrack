import { describe, it, expect } from 'vitest';
import {
  statusForSubcriterion,
  buildComplianceReport,
  isCurrent,
  NO_VALIDATED_EVIDENCE_MESSAGE,
} from '../src/services/compliance.service.js';

const NOW = new Date('2026-05-29T00:00:00Z');

// Helpers para fechas relativas a NOW.
const yearsAgo = (y) => new Date(NOW.getTime() - y * 365.25 * 24 * 60 * 60 * 1000);
const doc = (id, ageYears) => ({ id, originalName: `doc${id}`, documentDate: yearsAgo(ageYears) });

describe('isCurrent (umbral de 3 años)', () => {
  it('un documento de 1 año está vigente', () => {
    expect(isCurrent(yearsAgo(1), NOW)).toBe(true);
  });
  it('un documento de 4 años no está vigente', () => {
    expect(isCurrent(yearsAgo(4), NOW)).toBe(false);
  });
});

describe('statusForSubcriterion (HU02)', () => {
  it('Insuficiente: sin documentos validados', () => {
    expect(statusForSubcriterion([], NOW)).toBe('Insuficiente');
  });

  it('Suficiente: 2 documentos validados y vigentes (<3 años)', () => {
    expect(statusForSubcriterion([doc(1, 1), doc(2, 2)], NOW)).toBe('Suficiente');
  });

  it('Parcial: solo 1 documento vigente', () => {
    expect(statusForSubcriterion([doc(1, 1)], NOW)).toBe('Parcial');
  });

  it('Parcial: 2 documentos pero ambos con más de 3 años', () => {
    expect(statusForSubcriterion([doc(1, 4), doc(2, 5)], NOW)).toBe('Parcial');
  });

  it('Parcial: 1 vigente y 1 vencido (solo 1 cuenta como vigente)', () => {
    expect(statusForSubcriterion([doc(1, 1), doc(2, 5)], NOW)).toBe('Parcial');
  });
});

describe('buildComplianceReport (HU02)', () => {
  it('sin ninguna asociación validada -> no se puede calcular + mensaje exacto', () => {
    const report = buildComplianceReport(
      [
        { id: 1, code: '9.1.1', name: 'A', level: 1, acceptedEvidenceTypes: [], validatedDocs: [] },
        { id: 2, code: '9.2.1', name: 'B', level: 2, acceptedEvidenceTypes: [], validatedDocs: [] },
      ],
      NOW
    );
    expect(report.canCalculate).toBe(false);
    expect(report.message).toBe(NO_VALIDATED_EVIDENCE_MESSAGE);
    expect(report.items).toEqual([]);
  });

  it('calcula estados mixtos y adjunta tipos de evidencia en Parcial/Insuficiente', () => {
    const report = buildComplianceReport(
      [
        { id: 1, code: '9.1.1', name: 'A', level: 1, required: true, acceptedEvidenceTypes: ['x'], validatedDocs: [doc(1, 1), doc(2, 2)] },
        { id: 2, code: '9.2.1', name: 'B', level: 2, required: false, acceptedEvidenceTypes: ['y'], validatedDocs: [doc(3, 1)] },
        { id: 3, code: '9.3.1', name: 'C', level: 3, required: false, acceptedEvidenceTypes: ['z'], validatedDocs: [] },
      ],
      NOW
    );
    expect(report.canCalculate).toBe(true);

    const byCode = Object.fromEntries(report.items.map((i) => [i.code, i]));
    expect(byCode['9.1.1'].status).toBe('Suficiente');
    expect(byCode['9.1.1'].color).toBe('green');
    expect(byCode['9.1.1'].acceptedEvidenceTypes).toBeUndefined(); // no se adjunta en Suficiente

    expect(byCode['9.2.1'].status).toBe('Parcial');
    expect(byCode['9.2.1'].color).toBe('yellow');
    expect(byCode['9.2.1'].acceptedEvidenceTypes).toEqual(['y']);

    expect(byCode['9.3.1'].status).toBe('Insuficiente');
    expect(byCode['9.3.1'].color).toBe('red');
    expect(byCode['9.3.1'].acceptedEvidenceTypes).toEqual(['z']);
  });

  it('propaga el nivel y la obligatoriedad de cada subcriterio (matriz de 3 niveles)', () => {
    const report = buildComplianceReport(
      [
        { id: 1, code: '9.1.1', name: 'A', level: 1, required: true, acceptedEvidenceTypes: [], validatedDocs: [doc(1, 1)] },
        { id: 2, code: '9.3.2', name: 'B', level: 3, required: false, acceptedEvidenceTypes: [], validatedDocs: [] },
        { id: 3, code: '9.2.2', name: 'C', acceptedEvidenceTypes: [], validatedDocs: [] }, // sin nivel -> 1 por defecto
      ],
      NOW
    );
    const byCode = Object.fromEntries(report.items.map((i) => [i.code, i]));
    expect(byCode['9.1.1'].level).toBe(1);
    expect(byCode['9.1.1'].required).toBe(true);
    expect(byCode['9.3.2'].level).toBe(3);
    expect(byCode['9.3.2'].required).toBe(false);
    expect(byCode['9.2.2'].level).toBe(1);
  });
});
