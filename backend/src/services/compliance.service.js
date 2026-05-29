// HU02 — Cálculo del estado de cumplimiento por subcriterio.
//
// Reglas (textuales del PDF):
//   - "Suficiente":   ≥ 2 documentos validados con < 3 años de antigüedad.
//   - "Parcial":      ≥ 1 documento validado pero con > 3 años de antigüedad,
//                     o si tiene solo 1 documento vigente.
//   - "Insuficiente": no tiene ningún documento validado asociado.
//
// La función es pura para poder testearla sin base de datos.

export const THREE_YEARS_MS = 3 * 365.25 * 24 * 60 * 60 * 1000;

export const NO_VALIDATED_EVIDENCE_MESSAGE =
  'No es posible calcular el cumplimiento porque no existen evidencias con asociación validada. ' +
  'Asocie al menos un documento a un criterio CNA antes de continuar.';

/**
 * ¿El documento está vigente (menos de 3 años de antigüedad)?
 * @param {Date|string} documentDate
 * @param {Date} now
 */
export function isCurrent(documentDate, now = new Date()) {
  const date = documentDate instanceof Date ? documentDate : new Date(documentDate);
  return now.getTime() - date.getTime() < THREE_YEARS_MS;
}

/**
 * Estado de un subcriterio a partir de sus documentos VALIDADOS.
 * @param {Array<{documentDate: Date|string}>} validatedDocs
 * @param {Date} now
 * @returns {'Suficiente'|'Parcial'|'Insuficiente'}
 */
export function statusForSubcriterion(validatedDocs, now = new Date()) {
  if (!validatedDocs || validatedDocs.length === 0) return 'Insuficiente';

  const currentDocs = validatedDocs.filter((d) => isCurrent(d.documentDate, now));

  // Suficiente: al menos 2 documentos validados y vigentes (< 3 años).
  if (currentDocs.length >= 2) return 'Suficiente';

  // Parcial: hay ≥1 validado pero no llega a "Suficiente"
  // (solo 1 vigente, o todos con > 3 años).
  return 'Parcial';
}

/**
 * Color de semáforo para el tablero (HU02 / Tablero de Salud Institucional).
 */
export function statusColor(status) {
  return { Suficiente: 'green', Parcial: 'yellow', Insuficiente: 'red' }[status] || 'red';
}

/**
 * Construye el reporte de cumplimiento del criterio.
 *
 * @param {Array} subcriteria  Lista de subcriterios, cada uno con:
 *   { id, code, name, acceptedEvidenceTypes, validatedDocs: [{id, originalName, documentDate}] }
 * @param {Date} now
 * @returns {{ canCalculate: boolean, message?: string, items: Array }}
 */
export function buildComplianceReport(subcriteria, now = new Date()) {
  const totalValidated = subcriteria.reduce(
    (acc, s) => acc + (s.validatedDocs ? s.validatedDocs.length : 0),
    0
  );

  if (totalValidated === 0) {
    return { canCalculate: false, message: NO_VALIDATED_EVIDENCE_MESSAGE, items: [] };
  }

  const items = subcriteria.map((s) => {
    const validatedDocs = s.validatedDocs || [];
    const status = statusForSubcriterion(validatedDocs, now);
    const item = {
      subcriterionId: s.id,
      code: s.code,
      name: s.name,
      status,
      color: statusColor(status),
      validatedCount: validatedDocs.length,
      documents: validatedDocs.map((d) => ({
        id: d.id,
        name: d.originalName,
        documentDate: d.documentDate,
        current: isCurrent(d.documentDate, now),
      })),
    };
    // En Parcial/Insuficiente se entregan los tipos de evidencia típicamente aceptados.
    if (status !== 'Suficiente') {
      item.acceptedEvidenceTypes = s.acceptedEvidenceTypes || [];
    }
    return item;
  });

  return { canCalculate: true, items };
}
