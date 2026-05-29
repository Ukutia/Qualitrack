// HU02 — Cálculo del estado de cumplimiento del Criterio 9.
import { prisma } from '../config/prisma.js';
import { buildComplianceReport } from '../services/compliance.service.js';

const CRITERION_CODE = '9';

export async function getCompliance(req, res) {
  const criterion = await prisma.criterion.findUnique({
    where: { code: CRITERION_CODE },
    include: {
      subcriteria: {
        include: {
          associations: {
            where: { status: 'VALIDATED' },
            include: { document: true },
          },
        },
        orderBy: { code: 'asc' },
      },
    },
  });

  if (!criterion) return res.status(404).json({ error: 'Criterio no configurado.' });

  const subcriteria = criterion.subcriteria.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    acceptedEvidenceTypes: s.acceptedEvidenceTypes,
    validatedDocs: s.associations.map((a) => ({
      id: a.document.id,
      originalName: a.document.originalName,
      documentDate: a.document.documentDate,
    })),
  }));

  const report = buildComplianceReport(subcriteria);
  return res.json({
    criterion: { code: criterion.code, name: criterion.name },
    ...report,
  });
}
