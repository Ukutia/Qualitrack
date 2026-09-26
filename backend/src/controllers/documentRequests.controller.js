import { prisma } from '../config/prisma.js';
import { ROLES } from '../config/roles.js';
import {
  intervalDaysToMinutes,
  cancelOutstandingRequestEmails,
  kickRequestEmailDelivery,
  minimumIntervalMinutes,
  nextReminderDate,
  requestEmailData,
  serializeDocumentRequest,
  MAX_INTERVAL_MINUTES,
  MINUTES_PER_DAY,
} from '../services/documentRequests.service.js';
import { createStoredRequestToken, hashRequestToken } from '../services/requestToken.service.js';
import { formatFromName } from '../middleware/upload.js';
import { saveFile, deleteFile } from '../services/storage.service.js';
import { extractText } from '../services/textExtraction.service.js';
import { extractDocumentDate } from '../services/dateExtraction.service.js';
import { encryptText } from '../services/encryption.service.js';
import { queueDocumentVectorization } from './documents.controller.js';
import { config } from '../config/env.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function accessWhere(user, id) {
  return {
    ...(id == null ? {} : { id }),
    ...(user.role === ROLES.ADMIN ? {} : { createdById: user.id }),
  };
}

async function accessibleRequest(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return prisma.documentRequest.findFirst({ where: accessWhere(req.user, id) });
}

function intervalError() {
  const minimum = minimumIntervalMinutes();
  const minLabel = minimum === MINUTES_PER_DAY ? '1 día' : '1 minuto (entorno de pruebas)';
  return `La frecuencia debe estar entre ${minLabel} y 30 días.`;
}

export function getDocumentRequestConfig(req, res) {
  const minimumMinutes = minimumIntervalMinutes();
  return res.json({
    allowSubdayIntervals: minimumMinutes < MINUTES_PER_DAY,
    minimumIntervalMinutes: minimumMinutes,
    minimumIntervalDays: minimumMinutes / MINUTES_PER_DAY,
    maximumIntervalDays: MAX_INTERVAL_MINUTES / MINUTES_PER_DAY,
  });
}

/** Consulta pública y de solo lectura para el enlace enviado al destinatario. */
export async function getPublicDocumentRequest(req, res) {
  res.set('Cache-Control', 'no-store');
  const token = String(req.params.token || '');
  if (!TOKEN_PATTERN.test(token)) {
    return res.status(404).json({
      error: 'El enlace no existe o ya no está vigente.',
      code: 'REQUEST_LINK_INVALID',
    });
  }

  const request = await prisma.documentRequest.findUnique({
    where: { tokenHash: hashRequestToken(token) },
    select: {
      id: true,
      description: true,
      status: true,
      tokenCreatedAt: true,
      updatedAt: true,
      documentId: true,
    },
  });

  // No se revela si fue rotado, pausado o cancelado. Todos esos casos deben
  // verse iguales desde Internet y ningún estado distinto de PENDING sirve.
  if (!request || request.status !== 'PENDING') {
    return res.status(404).json({
      error: 'El enlace no existe o ya no está vigente.',
      code: 'REQUEST_LINK_INVALID',
    });
  }

  return res.json({
    requestId: request.id,
    description: request.description,
    status: request.status,
    tokenCreatedAt: request.tokenCreatedAt,
    maxFileSizeMb: config.maxFileSizeMb,
    acceptedFormats: ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
  });
}

export async function uploadPublicDocumentRequest(req, res) {
  res.set('Cache-Control', 'no-store');
  const token = String(req.params.token || '');
  if (!TOKEN_PATTERN.test(token) || !req.file) {
    return res.status(!req.file ? 400 : 404).json({
      error: !req.file ? 'Seleccione un archivo para continuar.' : 'El enlace no existe o ya no está vigente.',
      code: !req.file ? 'FILE_REQUIRED' : 'REQUEST_LINK_INVALID',
    });
  }

  const tokenHash = hashRequestToken(token);
  const request = await prisma.documentRequest.findUnique({
    where: { tokenHash },
    select: { id: true, recipientEmail: true, status: true, createdById: true, documentId: true },
  });
  if (!request || request.status !== 'PENDING' || request.documentId) {
    return res.status(404).json({
      error: 'El enlace no existe o ya no está vigente.',
      code: 'REQUEST_LINK_INVALID',
    });
  }

  const originalName = req.file.originalname;
  const format = formatFromName(originalName);
  const extractedText = await extractText(req.file.buffer, format);
  const documentDate = extractDocumentDate(extractedText, originalName) ?? new Date();
  const stored = await saveFile(req.file.buffer, originalName);

  let document;
  try {
    document = await prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          originalName,
          storedName: stored.storedName,
          format,
          sizeBytes: req.file.buffer.length,
          storagePath: stored.storagePath,
          source: 'UPLOAD',
          extractedText: encryptText(extractedText),
          vectorizationStatus: 'PROCESSING',
          documentDate,
          uploadedById: request.createdById,
          externalUploaderEmail: request.recipientEmail,
        },
      });
      const claimed = await tx.documentRequest.updateMany({
        where: {
          id: request.id,
          status: 'PENDING',
          tokenHash,
          documentId: null,
        },
        data: {
          status: 'RECEIVED',
          documentId: created.id,
          tokenHash: null,
          tokenEncrypted: null,
          tokenCreatedAt: null,
          nextReminderAt: null,
        },
      });
      if (!claimed.count) {
        const error = new Error('El enlace ya fue utilizado.');
        error.code = 'REQUEST_LINK_ALREADY_USED';
        throw error;
      }
      await cancelOutstandingRequestEmails(tx, request.id);
      return created;
    });
  } catch (error) {
    await deleteFile(stored.storagePath);
    if (error.code === 'REQUEST_LINK_ALREADY_USED') {
      return res.status(409).json({ error: 'El enlace ya fue utilizado o dejó de estar vigente.', code: error.code });
    }
    throw error;
  }

  queueDocumentVectorization(document.id, extractedText);
  return res.status(201).json({
    requestId: request.id,
    documentId: document.id,
    name: document.originalName,
    status: 'RECEIVED',
    message: 'Documento recibido correctamente.',
  });
}

export async function listDocumentRequests(req, res) {
  const requests = await prisma.documentRequest.findMany({
    where: accessWhere(req.user),
    orderBy: { createdAt: 'desc' },
  });
  return res.json(requests.map(serializeDocumentRequest));
}

export async function createDocumentRequest(req, res) {
  const recipientEmail = String(req.body.recipientEmail || '').trim().toLowerCase();
  const description = String(req.body.description || '').trim();
  const reminderIntervalMinutes = intervalDaysToMinutes(req.body.reminderIntervalDays);

  if (!EMAIL_PATTERN.test(recipientEmail) || recipientEmail.length > 254) {
    return res.status(400).json({ error: 'Ingrese un correo destinatario válido.', code: 'INVALID_EMAIL' });
  }
  if (description.length < 3 || description.length > 2000) {
    return res.status(400).json({
      error: 'La descripción debe tener entre 3 y 2000 caracteres.',
      code: 'INVALID_DESCRIPTION',
    });
  }
  if (!reminderIntervalMinutes || reminderIntervalMinutes > MAX_INTERVAL_MINUTES) {
    return res.status(400).json({ error: intervalError(), code: 'INVALID_INTERVAL' });
  }

  const now = new Date();
  const tokenData = createStoredRequestToken();
  const { request, email } = await prisma.$transaction(async (tx) => {
    const created = await tx.documentRequest.create({
      data: {
        recipientEmail,
        description,
        reminderIntervalMinutes,
        nextReminderAt: nextReminderDate(reminderIntervalMinutes, now),
        ...tokenData,
        tokenCreatedAt: now,
        createdById: req.user.id,
      },
    });
    const queuedEmail = await tx.documentRequestEmail.create({
      data: requestEmailData(created.id, created.tokenVersion, 'INITIAL', now),
    });
    return { request: created, email: queuedEmail };
  });

  kickRequestEmailDelivery(email.id);
  return res.status(201).json(serializeDocumentRequest(request));
}

export async function pauseDocumentRequest(req, res) {
  const request = await accessibleRequest(req);
  if (!request) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  if (request.status !== 'PENDING') {
    return res.status(409).json({ error: 'Solo se puede pausar una solicitud pendiente.', code: 'INVALID_STATUS' });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.documentRequest.updateMany({
      where: { ...accessWhere(req.user, request.id), status: 'PENDING' },
      data: {
        status: 'PAUSED',
        tokenHash: null,
        tokenEncrypted: null,
        tokenCreatedAt: null,
        nextReminderAt: null,
      },
    });
    if (result.count) await cancelOutstandingRequestEmails(tx, request.id);
    return result;
  });
  if (!updated.count) return res.status(409).json({ error: 'La solicitud cambió de estado. Actualice la página.' });
  return res.json(serializeDocumentRequest(await accessibleRequest(req)));
}

export async function resumeDocumentRequest(req, res) {
  const request = await accessibleRequest(req);
  if (!request) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  if (request.status !== 'PAUSED') {
    return res.status(409).json({ error: 'Solo se puede reanudar una solicitud pausada.', code: 'INVALID_STATUS' });
  }

  const now = new Date();
  const { updated, email } = await prisma.$transaction(async (tx) => {
    const result = await tx.documentRequest.updateMany({
      where: { ...accessWhere(req.user, request.id), status: 'PAUSED' },
      data: {
        status: 'PENDING',
        ...createStoredRequestToken(),
        tokenVersion: { increment: 1 },
        tokenCreatedAt: now,
        nextReminderAt: nextReminderDate(request.reminderIntervalMinutes, now),
      },
    });
    if (!result.count) return { updated: result, email: null };
    await cancelOutstandingRequestEmails(tx, request.id);
    const queuedEmail = await tx.documentRequestEmail.create({
      data: requestEmailData(request.id, request.tokenVersion + 1, 'RESUMED', now),
    });
    return { updated: result, email: queuedEmail };
  });
  if (!updated.count) return res.status(409).json({ error: 'La solicitud cambió de estado. Actualice la página.' });
  kickRequestEmailDelivery(email.id);
  return res.json(serializeDocumentRequest(await accessibleRequest(req)));
}

export async function cancelDocumentRequest(req, res) {
  const request = await accessibleRequest(req);
  if (!request) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  if (!['PENDING', 'PAUSED'].includes(request.status)) {
    return res.status(409).json({ error: 'Esta solicitud ya no puede cancelarse.', code: 'INVALID_STATUS' });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.documentRequest.updateMany({
      where: { ...accessWhere(req.user, request.id), status: { in: ['PENDING', 'PAUSED'] } },
      data: {
        status: 'CANCELLED',
        tokenHash: null,
        tokenEncrypted: null,
        tokenCreatedAt: null,
        nextReminderAt: null,
      },
    });
    if (result.count) await cancelOutstandingRequestEmails(tx, request.id);
    return result;
  });
  if (!updated.count) return res.status(409).json({ error: 'La solicitud cambió de estado. Actualice la página.' });
  return res.json(serializeDocumentRequest(await accessibleRequest(req)));
}

export async function deleteDocumentRequest(req, res) {
  const request = await accessibleRequest(req);
  if (!request) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  if (!['PAUSED', 'CANCELLED'].includes(request.status)) {
    return res.status(409).json({
      error: 'Solo se pueden eliminar solicitudes pausadas o canceladas.',
      code: 'INVALID_STATUS',
    });
  }

  const deleted = await prisma.documentRequest.deleteMany({
    where: {
      ...accessWhere(req.user, request.id),
      status: { in: ['PAUSED', 'CANCELLED'] },
    },
  });
  if (!deleted.count) {
    return res.status(409).json({ error: 'La solicitud cambió de estado. Actualice la página.' });
  }
  return res.status(204).send();
}
