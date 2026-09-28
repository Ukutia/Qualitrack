import { prisma } from '../config/prisma.js';
import { config } from '../config/env.js';
import { createStoredRequestToken, decryptRequestToken } from './requestToken.service.js';
import { sendRequestEmail } from './requestEmail.service.js';

export const MINUTES_PER_DAY = 1440;
export const MAX_INTERVAL_MINUTES = 30 * MINUTES_PER_DAY;

export function minimumIntervalMinutes() {
  return config.allowSubdayRequestIntervals ? 1 : MINUTES_PER_DAY;
}

export function intervalDaysToMinutes(value) {
  const days = Number(value);
  if (!Number.isFinite(days)) return null;
  const minutes = Math.round(days * MINUTES_PER_DAY);
  if (minutes < minimumIntervalMinutes() || minutes > MAX_INTERVAL_MINUTES) return null;
  return minutes;
}

export function nextReminderDate(minutes, now = new Date()) {
  return new Date(now.getTime() + minutes * 60_000);
}

export function serializeDocumentRequest(request) {
  return {
    id: request.id,
    recipientEmail: request.recipientEmail,
    description: request.description,
    status: request.status,
    reminderIntervalMinutes: request.reminderIntervalMinutes,
    reminderIntervalDays: request.reminderIntervalMinutes / MINUTES_PER_DAY,
    nextReminderAt: request.nextReminderAt,
    token: request.tokenEncrypted ? decryptRequestToken(request.tokenEncrypted) : null,
    tokenVersion: request.tokenVersion,
    tokenCreatedAt: request.tokenCreatedAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

export function requestEmailData(requestId, tokenVersion, type, now = new Date()) {
  return {
    requestId,
    tokenVersion,
    type,
    status: 'PENDING',
    nextAttemptAt: now,
  };
}

export function cancelOutstandingRequestEmails(db, requestId) {
  return db.documentRequestEmail.updateMany({
    where: { requestId, status: { in: ['PENDING', 'FAILED', 'SENDING'] } },
    data: { status: 'CANCELLED' },
  });
}

function publicRequestUrl(encryptedToken) {
  const token = decryptRequestToken(encryptedToken);
  return `${config.frontendUrl.replace(/\/$/, '')}/document-request/${encodeURIComponent(token)}`;
}

export async function deliverRequestEmail(deliveryId, now = new Date(), db = prisma) {
  const staleBefore = new Date(now.getTime() - 5 * 60_000);
  const claimed = await db.documentRequestEmail.updateMany({
    where: {
      id: deliveryId,
      OR: [
        { status: { in: ['PENDING', 'FAILED'] }, nextAttemptAt: { lte: now } },
        { status: 'SENDING', lastAttemptAt: { lte: staleBefore } },
      ],
    },
    data: { status: 'SENDING', lastAttemptAt: now, attemptCount: { increment: 1 } },
  });
  if (!claimed.count) return false;

  const delivery = await db.documentRequestEmail.findUnique({
    where: { id: deliveryId },
    include: { request: true },
  });
  const request = delivery?.request;
  if (
    !delivery ||
    !request ||
    request.status !== 'PENDING' ||
    request.tokenVersion !== delivery.tokenVersion ||
    !request.tokenEncrypted
  ) {
    await db.documentRequestEmail.updateMany({
      where: { id: deliveryId, status: 'SENDING' },
      data: { status: 'CANCELLED' },
    });
    return false;
  }

  try {
    const info = await sendRequestEmail({
      recipientEmail: request.recipientEmail,
      description: request.description,
      publicUrl: publicRequestUrl(request.tokenEncrypted),
      type: delivery.type,
    });
    await db.documentRequestEmail.updateMany({
      where: { id: deliveryId, status: 'SENDING' },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        providerMessageId: info.messageId || null,
        lastError: null,
      },
    });
    return true;
  } catch (error) {
    const nextAttemptAt = new Date(now.getTime() + config.requestEmailRetrySeconds * 1000);
    await db.documentRequestEmail.updateMany({
      where: { id: deliveryId, status: 'SENDING' },
      data: {
        status: 'FAILED',
        nextAttemptAt,
        lastError: String(error?.message || error).slice(0, 2000),
      },
    });
    console.error(`[requests] Falló el correo ${deliveryId}; se reintentará:`, error?.message || error);
    return false;
  }
}

export async function processPendingRequestEmails(now = new Date(), db = prisma) {
  const staleBefore = new Date(now.getTime() - 5 * 60_000);
  const due = await db.documentRequestEmail.findMany({
    where: {
      OR: [
        { status: { in: ['PENDING', 'FAILED'] }, nextAttemptAt: { lte: now } },
        { status: 'SENDING', lastAttemptAt: { lte: staleBefore } },
      ],
    },
    orderBy: { nextAttemptAt: 'asc' },
    take: 100,
    select: { id: true },
  });
  let sent = 0;
  for (const delivery of due) {
    if (await deliverRequestEmail(delivery.id, now, db)) sent += 1;
  }
  return sent;
}

export function kickRequestEmailDelivery(deliveryId) {
  setImmediate(() => {
    deliverRequestEmail(deliveryId).catch((error) => {
      console.error(`[requests] Error procesando correo ${deliveryId}:`, error);
    });
  });
}

export async function rotateDueDocumentRequests(now = new Date(), db = prisma) {
  const due = await db.documentRequest.findMany({
    where: { status: 'PENDING', nextReminderAt: { lte: now } },
    orderBy: { nextReminderAt: 'asc' },
    take: 100,
    select: { id: true, tokenVersion: true, nextReminderAt: true, reminderIntervalMinutes: true },
  });

  let rotated = 0;
  for (const request of due) {
    const nextToken = createStoredRequestToken();
    // La fecha exacta en el WHERE funciona como compare-and-swap. Si otra
    // instancia ya rotó o el usuario pausó/canceló, count será cero.
    const didRotate = await db.$transaction(async (tx) => {
      const result = await tx.documentRequest.updateMany({
        where: {
          id: request.id,
          status: 'PENDING',
          tokenVersion: request.tokenVersion,
          nextReminderAt: request.nextReminderAt,
        },
        data: {
          ...nextToken,
          tokenVersion: { increment: 1 },
          tokenCreatedAt: now,
          nextReminderAt: nextReminderDate(request.reminderIntervalMinutes, now),
        },
      });
      if (!result.count) return false;
      await cancelOutstandingRequestEmails(tx, request.id);
      await tx.documentRequestEmail.create({
        data: requestEmailData(request.id, request.tokenVersion + 1, 'REMINDER', now),
      });
      return true;
    });
    if (didRotate) rotated += 1;
  }
  return rotated;
}

let schedulerTimer;
let schedulerRunning = false;

export function startDocumentRequestScheduler() {
  if (schedulerTimer) return schedulerTimer;

  const tick = async () => {
    if (schedulerRunning) return;
    schedulerRunning = true;
    try {
      const count = await rotateDueDocumentRequests();
      if (count) console.info(`[requests] ${count} token(s) rotado(s).`);
      const sent = await processPendingRequestEmails();
      if (sent) console.info(`[requests] ${sent} correo(s) enviado(s).`);
    } catch (error) {
      console.error('[requests] Falló la revisión automática:', error);
    } finally {
      schedulerRunning = false;
    }
  };

  schedulerTimer = setInterval(tick, config.requestSchedulerIntervalMs);
  schedulerTimer.unref?.();
  void tick();
  return schedulerTimer;
}

export function stopDocumentRequestScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerTimer = undefined;
}
