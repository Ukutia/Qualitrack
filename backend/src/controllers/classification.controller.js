// HU01 — Asociación de evidencia al Criterio 9 (propuesta / validar / descartar).
import { prisma } from '../config/prisma.js';
import { classifyText } from '../services/classifier.service.js';
import { decryptText } from '../services/encryption.service.js';

const CRITERION_CODE = '9';

async function supersedeAssociations(tx, { documentId, keepId, userId, snapshot }) {
  const superseded = await tx.association.findMany({
    where: {
      documentId,
      id: { not: keepId },
      status: { in: ['PROPOSED', 'VALIDATED'] },
    },
  });

  if (superseded.length === 0) return;

  await tx.association.updateMany({
    where: { id: { in: superseded.map((association) => association.id) } },
    data: { status: 'NOT_VALIDATED', validatedById: null, validatedAt: null },
  });

  await tx.associationHistory.createMany({
    data: superseded.map((association) => ({
      associationId: association.id,
      action: 'REJECTED',
      userId,
      snapshot,
    })),
  });
}

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

   // La nueva clasificación queda pendiente. Sustituye una propuesta pendiente
  // anterior, pero nunca desplaza la asociación validada hasta que se apruebe.
  const association = await prisma.$transaction(async (tx) => {
    const pending = await tx.association.findMany({
      where: { documentId, status: 'PROPOSED' },
    });

    if (pending.length) {
      await tx.association.updateMany({
        where: { id: { in: pending.map((item) => item.id) } },
        data: { status: 'NOT_VALIDATED', validatedById: null, validatedAt: null },
      });
      await tx.associationHistory.createMany({
        data: pending.map((item) => ({
          associationId: item.id,
          action: 'REJECTED',
          userId: req.user.id,
          snapshot: { reemplazadaPorNuevaPropuestaIA: true },
        })),
      });
    }

    const created = await tx.association.create({
      data: {
        documentId,
        subcriterionId: result.subcriterionId,
        status: 'PROPOSED',
        justification: result.justification,
        evidenceFragment: result.evidenceFragment,
        confidence: result.confidence,
      },
      include: { subcriterion: true },
    });

    await tx.associationHistory.create({
      data: {
        associationId: created.id,
        action: 'PROPOSED',
        userId: req.user.id,
        snapshot: {
          subcriterion: created.subcriterion.code,
          confidence: result.confidence,
          matchedKeywords: result.matchedKeywords,
        },
      },
    });

    return created;
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

  if (assoc.status !== 'PROPOSED') {
    return res.status(409).json({ error: 'La asociación ya no es una propuesta pendiente.' });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await supersedeAssociations(tx, {
      documentId: assoc.documentId,
      keepId: id,
      userId: req.user.id,
      snapshot: { reemplazadaAlValidar: true, nuevaAsociacionId: id },
    });

    const validated = await tx.association.update({
      where: { id },
      data: { status: 'VALIDATED', validatedById: req.user.id, validatedAt: new Date() },
    });
    await tx.associationHistory.create({
      data: { associationId: id, action: 'VALIDATED', userId: req.user.id },
    });

    return validated;
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
 * Cuando el usuario elige un subcriterio a mano, la nueva asociación queda
 * validada por él y reemplaza cualquier asociación vigente o propuesta. Las
 * anteriores se conservan como no validadas para mantener la auditoría.
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

  const association = await prisma.$transaction(async (tx) => {
    const created = await tx.association.create({
      data: {
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

    await supersedeAssociations(tx, {
      documentId,
      keepId: created.id,
      userId: req.user.id,
      snapshot: {
        reasignadaManualmente: true,
        nuevoSubcriterio: subcriterion.code,
        nuevaAsociacionId: created.id,
      },
    });

    await tx.associationHistory.create({
      data: {
        associationId: created.id,
        action: 'VALIDATED',
        userId: req.user.id,
        snapshot: { manual: true, subcriterion: subcriterion.code },
      },
    });

    return created;
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
