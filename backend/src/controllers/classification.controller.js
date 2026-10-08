// HU01 — Asociación de evidencia al Criterio 9 (propuesta / validar / descartar).
import { prisma } from '../config/prisma.js';
import { classifyByKeywords } from '../services/classifier.service.js';
import { decryptText } from '../services/encryption.service.js';
import { sendToWorker } from '../services/workerClient.service.js';
import { iaCaida } from '../services/workerQueue.service.js';
import { updateAnalysisStatus } from '../services/analysisEvents.service.js';
import {
  plainWorkerContent,
  encryptedWorkerContent,
  decryptWorkerContent,
} from '../services/workerPayload.service.js';

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

/**
 * GET /documents/:id/transmission-preview — lo que se enviaría al worker
 * (CDA2). Usa la misma función que el envío real, así que lo mostrado es
 * exactamente lo que sale a la red, con un IV nuevo como cualquier envío. No
 * cambia el estado del documento ni contacta al worker.
 */
export async function previewTransmission(req, res) {
  const documentId = Number(req.params.id);
  const doc = await prisma.document.findFirst({ where: { id: documentId, deletedAt: null } });
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });

  let contenido;
  let payload;
  try {
    ({ contenido } = await plainWorkerContent(doc));
    payload = await encryptedWorkerContent(doc);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  const cifrado = Buffer.from(payload.fileData, 'base64');
  const texto = contenido.toString('utf-8');
  // Una frase del original para buscarla dentro de lo transmitido.
  const muestra = texto.replace(/\s+/g, ' ').trim().slice(0, 40);
  let coincidencias = 0;
  for (let i = 0; i < contenido.length; i++) if (contenido[i] === cifrado[i]) coincidencias++;

  return res.json({
    algorithm: 'AES-256-GCM',
    format: payload.format,
    iv: payload.iv,
    authTag: payload.authTag,
    original: texto,
    transmitted: payload.fileData,
    bytes: contenido.length,
    sample: muestra,
    sampleFound: cifrado.includes(muestra) || payload.fileData.includes(muestra),
    matchingBytesPct: contenido.length ? (coincidencias / contenido.length) * 100 : 0,
    roundTripOk: decryptWorkerContent(payload).equals(contenido),
  });
}

/** POST /documents/:id/classify — genera (o regenera) la propuesta automática. */
export async function classifyDocument(req, res) {
  const documentId = Number(req.params.id);

  // Sin esto, un id no numerico llega como NaN a Prisma, que lanza; y como
  // Express 4 no atrapa los rechazos de un handler async, el proceso entero
  // se cae. Una URL mal formada no puede tumbar el backend.
  if (!Number.isInteger(documentId) || documentId <= 0) {
    return res.status(400).json({ error: 'Id de documento invalido.' });
  }

  const doc = await prisma.document.findFirst({
    where: {
      id: documentId,
      deletedAt: null,
    },
  });

  if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });

  // Dejar el documento en PREPARING_ANALYSIS es todo el despacho: el worker
  // pregunta por el (GET /worker/jobs) y se lo lleva. El backend no lo llama,
  // porque el worker corre en una maquina sin IP estable ni puertos abiertos.
  //
  // El efecto util de encolar en vez de empujar: si el worker esta caido, el
  // documento espera en la cola y se procesa al volver, en lugar de fallar.
  await updateAnalysisStatus(documentId, 'PREPARING_ANALYSIS');

  // Se despacha al worker sin esperarlo: clasificar toma segundos y bloquear
  // aqui dejaria colgada la conexion del usuario. El resultado vuelve por el
  // webhook y de ahi al navegador por SSE.
  if (!iaCaida()) setImmediate(() => { void sendToWorker(documentId, req.user.id); });
  return res.status(202).json({
    accepted: true,
    analysisStatus: 'PREPARING_ANALYSIS',
  });
}

/** POST /documents/:id/classify/fallback — clasificación de respaldo por keywords. */
export async function classifyDocumentFallback(req, res) {
  const documentId = Number(req.params.id);

  const doc = await prisma.document.findFirst({
    where: {
      id: documentId,
      deletedAt: null,
    },
  });

  if (!doc) {
    return res.status(404).json({
      error: 'Documento no encontrado.',
    });
  }

  // El respaldo solo se puede usar si el análisis principal falló
  // o si han pasado al menos 3 minutos desde que comenzó.
  const analysisFailed = doc.analysisStatus === 'ERROR';

  const analysisStartedAt = doc.analysisStartedAt
    ? new Date(doc.analysisStartedAt).getTime()
    : null;

  const elapsedMs = analysisStartedAt
    ? Date.now() - analysisStartedAt
    : 0;

  const fallbackAllowed =
    analysisFailed || elapsedMs >= 3 * 60 * 1000;

  if (!fallbackAllowed) {
    return res.status(409).json({
      code: 'FALLBACK_NOT_AVAILABLE',
      error:
        'La clasificación de respaldo estará disponible cuando el análisis principal falle o supere los 3 minutos.',
    });
  }

  const subcriteria = await prisma.subcriterion.findMany({
    where: {
      criterion: {
        code: CRITERION_CODE,
      },
    },
  });

  const result = classifyByKeywords(
    decryptText(doc.extractedText) || '',
    subcriteria
  );

  // Si no encuentra una clasificación, no se guarda ninguna asociación
  if (!result.relevant || !result.subcriterion) {
    return res.json({
      relevant: result.relevant,
      engine: 'keywords',
      matchedKeywordCount: result.matchedKeywords.length,
      matchedKeywords: result.matchedKeywords,
      justification: result.justification,
      evidenceFragment: result.evidenceFragment,
      confidence: result.confidence,
      subcriterion: null,
    });
  }

  // Evitar crear una propuesta duplicada para el mismo subcriterio
const existingAssociation = await prisma.association.findFirst({
  where: {
    documentId: doc.id,
    subcriterionId: result.subcriterion.id,
    status: {
      in: ['PROPOSED', 'VALIDATED'],
    },
  },
  orderBy: {
    createdAt: 'desc',
  },
});

if (existingAssociation) {
  return res.json({
    relevant: true,
    engine: 'keywords',
    matchedKeywordCount: result.matchedKeywords.length,
    matchedKeywords: result.matchedKeywords,
    justification: result.justification,
    evidenceFragment: result.evidenceFragment,
    confidence: result.confidence,
    subcriterion: {
      id: result.subcriterion.id,
      code: result.subcriterion.code,
      name: result.subcriterion.name,
    },
    association: {
      id: existingAssociation.id,
      status: existingAssociation.status,
    },
    alreadyExists: true,
  });
}

  // Crear la propuesta de clasificación
  const association = await prisma.association.create({
    data: {
      documentId: doc.id,
      subcriterionId: result.subcriterion.id,
      status: 'PROPOSED',
      engine: 'keywords',
      justification: result.justification,
      evidenceFragment: result.evidenceFragment,
      confidence: result.confidence,
    },
  });

  // Registrar en el historial que se generó una propuesta mediante fallback
  await prisma.associationHistory.create({
    data: {
      associationId: association.id,
      action: 'PROPOSED',
      userId: req.user.id,
      snapshot: {
        engine: 'keywords',
        matchedKeywords: result.matchedKeywords,
        matchedKeywordCount: result.matchedKeywords.length,
      },
    },
  });

  return res.json({
    relevant: result.relevant,
    engine: 'keywords',
    matchedKeywordCount: result.matchedKeywords.length,
    matchedKeywords: result.matchedKeywords,
    justification: result.justification,
    evidenceFragment: result.evidenceFragment,
    confidence: result.confidence,
    subcriterion: {
      id: result.subcriterion.id,
      code: result.subcriterion.code,
      name: result.subcriterion.name,
    },
    association: {
      id: association.id,
      status: association.status,
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
        engine: 'manual',
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