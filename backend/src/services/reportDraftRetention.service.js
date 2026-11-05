import { prisma } from '../config/prisma.js';

export const REPORT_DRAFT_VERSION_RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function reportDraftVersionCutoff(now = new Date()) {
  return new Date(now.getTime() - REPORT_DRAFT_VERSION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export function purgeExpiredReportDraftVersions(db = prisma, now = new Date(), draftId = null) {
  // La retención afecta exclusivamente instantáneas históricas. Nunca elimina
  // ReportDraft, aunque el borrador lleve meses sin actividad.
  return db.reportDraftVersion.deleteMany({
    where: {
      createdAt: { lt: reportDraftVersionCutoff(now) },
      ...(draftId == null ? {} : { draftId: Number(draftId) }),
    },
  });
}

let cleanupTimer;
let cleanupRunning = false;

export function startReportDraftVersionCleanup() {
  if (cleanupTimer) return cleanupTimer;

  const tick = async () => {
    if (cleanupRunning) return;
    cleanupRunning = true;
    try {
      const { count } = await purgeExpiredReportDraftVersions();
      if (count > 0) console.log(`[report-drafts] ${count} versión(es) expirada(s) eliminada(s).`);
    } catch (error) {
      console.error('[report-drafts] No se pudo limpiar el historial expirado:', error);
    } finally {
      cleanupRunning = false;
    }
  };

  void tick();
  cleanupTimer = setInterval(tick, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();
  return cleanupTimer;
}

export function stopReportDraftVersionCleanup() {
  if (cleanupTimer) clearInterval(cleanupTimer);
  cleanupTimer = undefined;
  cleanupRunning = false;
}
