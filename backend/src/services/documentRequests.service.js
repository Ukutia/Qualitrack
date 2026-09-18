import { prisma } from '../config/prisma.js';
import { config } from '../config/env.js';
import { createRequestToken, decryptRequestToken } from './requestToken.service.js';

export const MINUTES_PER_DAY = 1440;
export const MAX_INTERVAL_MINUTES = 30 * MINUTES_PER_DAY;

export function minimumIntervalMinutes() {
  return config.nodeEnv === 'production' ? MINUTES_PER_DAY : 1;
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

export async function rotateDueDocumentRequests(now = new Date(), db = prisma) {
  const due = await db.documentRequest.findMany({
    where: { status: 'PENDING', nextReminderAt: { lte: now } },
    orderBy: { nextReminderAt: 'asc' },
    take: 100,
    select: { id: true, nextReminderAt: true, reminderIntervalMinutes: true },
  });

  let rotated = 0;
  for (const request of due) {
    const nextToken = createRequestToken();
    // La fecha exacta en el WHERE funciona como compare-and-swap. Si otra
    // instancia ya rotó o el usuario pausó/canceló, count será cero.
    const result = await db.documentRequest.updateMany({
      where: {
        id: request.id,
        status: 'PENDING',
        nextReminderAt: request.nextReminderAt,
      },
      data: {
        ...nextToken,
        tokenVersion: { increment: 1 },
        tokenCreatedAt: now,
        nextReminderAt: nextReminderDate(request.reminderIntervalMinutes, now),
      },
    });
    rotated += result.count;
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
