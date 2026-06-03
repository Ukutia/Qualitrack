// HU01 — Asociación de evidencia al Criterio 9 (propuesta / validar / descartar).
import { prisma } from '../config/prisma.js';
import { classifyText } from '../services/classifier.service.js';

const CRITERION_CODE = '9';

/** POST /documents/:id/classify — genera (o regenera) la propuesta automática. */
export async function classifyDocument(req, res) {
  const documentId = Number(req.params.id);
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });

  const subcriteria = await prisma.subcriterion.findMany({
    where: { criterion: { code: CRITERION_CODE } },
  });

  const result = classifyText(doc.extractedText || '', subcriteria);

  if (!result.relevant) {
    return res.json({
      relevant: false,
      justification: result.justification,
      association: null,
    });
  }

  // Crea o actualiza la asociación propuesta para este documento+subcriterio.
  const association = await prisma.association.upsert({
    where: {
      documentId_subcriterionId: { documentId, subcriterionId: result.subcriterionId },
    },
    update: {
      status: 'PROPOSED',
      justification: result.justification,
      evidenceFragment: result.evidenceFragment,
      confidence: result.confidence,
      validatedById: null,
      validatedAt: null,
    },
    create: {
      documentId,
      subcriterionId: result.subcriterionId,
      status: 'PROPOSED',
      justification: result.justification,
      evidenceFragment: result.evidenceFragment,
      confidence: result.confidence,
    },
    include: { subcriterion: true },
  });

  await prisma.associationHistory.create({
    data: {
      associationId: association.id,
      action: 'PROPOSED',
      userId: req.user.id,
      snapshot: {
        subcriterion: association.subcriterion.code,
        confidence: result.confidence,
        matchedKeywords: result.matchedKeywords,
      },
    },
  });

  return res.json({
    relevant: true,
    association: {
      id: association.id,
      status: association.status,
      subcriterion: {
        code: association.subcriterion.code,
        name: association.subcriterion.name,
      },
      justification: association.justification,
      evidenceFragment: association.evidenceFragment,
      confidence: association.confidence,
    },
  });
}

/** POST /associations/:id/validate */
export async function validateAssociation(req, res) {
  const id = Number(req.params.id);
  const assoc = await prisma.association.findUnique({ where: { id } });
  if (!assoc) return res.status(404).json({ error: 'Asociación no encontrada.' });

  const updated = await prisma.association.update({
    where: { id },
    data: { status: 'VALIDATED', validatedById: req.user.id, validatedAt: new Date() },
  });
  await prisma.associationHistory.create({
    data: { associationId: id, action: 'VALIDATED', userId: req.user.id },
  });
  return res.json({ id: updated.id, status: updated.status, validatedAt: updated.validatedAt });
}

/**
 * POST /associations/:id/reject — descarta la validación: la asociación vuelve a
 * quedar "sin estado" (PROPOSED). Conserva la propuesta original en el historial.
 */
export async function rejectAssociation(req, res) {
  const id = Number(req.params.id);
  const assoc = await prisma.association.findUnique({ where: { id } });
  if (!assoc) return res.status(404).json({ error: 'Asociación no encontrada.' });

  const updated = await prisma.association.update({
    where: { id },
    data: { status: 'PROPOSED', validatedById: null, validatedAt: null },
  });
  await prisma.associationHistory.create({
    data: {
      associationId: id,
      action: 'REJECTED',
      userId: req.user.id,
      snapshot: {
        descartada: true,
        propuestaOriginal: {
          justification: assoc.justification,
          confidence: assoc.confidence,
        },
      },
    },
  });
  return res.json({ id: updated.id, status: updated.status });
}
