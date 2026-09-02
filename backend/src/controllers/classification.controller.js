// HU01 — Asociación de evidencia al Criterio 9 (propuesta / validar / descartar).
import { prisma } from '../config/prisma.js';
import { classifyText } from '../services/classifier.service.js';
import { decryptText } from '../services/encryption.service.js';

const CRITERION_CODE = '9';

/** POST /documents/:id/classify — genera (o regenera) la propuesta automática. */
export async function classifyDocument(req, res) {
  const documentId = Number(req.params.id);
  const doc = await prisma.document.findFirst({
    where: {
      id: documentId,
      deletedAt: null,
    },
  });
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });

  const subcriteria = await prisma.subcriterion.findMany({
    where: { criterion: { code: CRITERION_CODE } },
  });

  const result = await classifyText(decryptText(doc.extractedText) || '', subcriteria);

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

/** POST /associations/:id/reject — conserva la propuesta original en el historial. */
export async function rejectAssociation(req, res) {
  const id = Number(req.params.id);
  const assoc = await prisma.association.findUnique({ where: { id } });
  if (!assoc) return res.status(404).json({ error: 'Asociación no encontrada.' });

  const updated = await prisma.association.update({
    where: { id },
    data: { status: 'NOT_VALIDATED', validatedById: null, validatedAt: null },
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

/**
 * PUT /documents/:id/association — reasignación manual del subcriterio (EP 1.2).
 *
 * Cuando el usuario no está de acuerdo con la propuesta de la IA, elige el
 * subcriterio a mano: la asociación elegida queda validada por él y la que
 * había propuesto el motor se marca como no validada, de modo que el historial
 * conserva quién corrigió y cuándo.
 *
 * La pertenencia del documento (rol User solo sobre lo propio; Admin sin
 * restricción) la resuelve requireOwnDocument en la ruta, no este controller.
 */
export async function reassignAssociation(req, res) {
  const documentId = Number(req.params.id);
  const subcriterionId = Number(req.body?.subcriterionId);
  if (!subcriterionId) {
    return res.status(400).json({ error: 'subcriterionId es obligatorio.' });
  }

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });

  const subcriterion = await prisma.subcriterion.findUnique({ where: { id: subcriterionId } });
  if (!subcriterion) return res.status(404).json({ error: 'Subcriterio no encontrado.' });

  // Las propuestas automáticas hacia otros subcriterios quedan descartadas.
  const superseded = await prisma.association.findMany({
    where: { documentId, status: 'PROPOSED', subcriterionId: { not: subcriterionId } },
  });
  if (superseded.length) {
    await prisma.association.updateMany({
      where: { id: { in: superseded.map((a) => a.id) } },
      data: { status: 'NOT_VALIDATED', validatedById: null, validatedAt: null },
    });
    await prisma.associationHistory.createMany({
      data: superseded.map((a) => ({
        associationId: a.id,
        action: 'REJECTED',
        userId: req.user.id,
        snapshot: { reasignadaManualmente: true, nuevoSubcriterio: subcriterion.code },
      })),
    });
  }

  const association = await prisma.association.upsert({
    where: { documentId_subcriterionId: { documentId, subcriterionId } },
    update: {
      status: 'VALIDATED',
      validatedById: req.user.id,
      validatedAt: new Date(),
    },
    create: {
      documentId,
      subcriterionId,
      status: 'VALIDATED',
      justification: 'Asignación manual del usuario.',
      confidence: 0,
      validatedById: req.user.id,
      validatedAt: new Date(),
    },
    include: { subcriterion: true },
  });

  await prisma.associationHistory.create({
    data: {
      associationId: association.id,
      action: 'VALIDATED',
      userId: req.user.id,
      snapshot: { manual: true, subcriterion: subcriterion.code },
    },
  });

  return res.json({
    id: association.id,
    status: association.status,
    subcriterion: {
      code: association.subcriterion.code,
      name: association.subcriterion.name,
      level: association.subcriterion.level,
    },
    validatedAt: association.validatedAt,
  });
}
