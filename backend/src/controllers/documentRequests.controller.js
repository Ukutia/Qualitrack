import { prisma } from '../config/prisma.js';
import { ROLES } from '../config/roles.js';
import {
  intervalDaysToMinutes,
  minimumIntervalMinutes,
  nextReminderDate,
  serializeDocumentRequest,
  MAX_INTERVAL_MINUTES,
  MINUTES_PER_DAY,
} from '../services/documentRequests.service.js';
import { createRequestToken } from '../services/requestToken.service.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const tokenData = createRequestToken();
  const request = await prisma.documentRequest.create({
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

  return res.status(201).json(serializeDocumentRequest(request));
}

export async function pauseDocumentRequest(req, res) {
  const request = await accessibleRequest(req);
  if (!request) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  if (request.status !== 'PENDING') {
    return res.status(409).json({ error: 'Solo se puede pausar una solicitud pendiente.', code: 'INVALID_STATUS' });
  }

  const updated = await prisma.documentRequest.updateMany({
    where: { ...accessWhere(req.user, request.id), status: 'PENDING' },
    data: {
      status: 'PAUSED',
      tokenHash: null,
      tokenEncrypted: null,
      tokenCreatedAt: null,
      nextReminderAt: null,
    },
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
  const updated = await prisma.documentRequest.updateMany({
    where: { ...accessWhere(req.user, request.id), status: 'PAUSED' },
    data: {
      status: 'PENDING',
      ...createRequestToken(),
      tokenVersion: { increment: 1 },
      tokenCreatedAt: now,
      nextReminderAt: nextReminderDate(request.reminderIntervalMinutes, now),
    },
  });
  if (!updated.count) return res.status(409).json({ error: 'La solicitud cambió de estado. Actualice la página.' });
  return res.json(serializeDocumentRequest(await accessibleRequest(req)));
}

export async function cancelDocumentRequest(req, res) {
  const request = await accessibleRequest(req);
  if (!request) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  if (!['PENDING', 'PAUSED'].includes(request.status)) {
    return res.status(409).json({ error: 'Esta solicitud ya no puede cancelarse.', code: 'INVALID_STATUS' });
  }

  const updated = await prisma.documentRequest.updateMany({
    where: { ...accessWhere(req.user, request.id), status: { in: ['PENDING', 'PAUSED'] } },
    data: {
      status: 'CANCELLED',
      tokenHash: null,
      tokenEncrypted: null,
      tokenCreatedAt: null,
      nextReminderAt: null,
    },
  });
  if (!updated.count) return res.status(409).json({ error: 'La solicitud cambió de estado. Actualice la página.' });
  return res.json(serializeDocumentRequest(await accessibleRequest(req)));
}
