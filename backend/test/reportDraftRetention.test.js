import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/prisma.js', () => ({
  prisma: { reportDraftVersion: { deleteMany: vi.fn() } },
}));

const { prisma } = await import('../src/config/prisma.js');
const {
  REPORT_DRAFT_VERSION_RETENTION_DAYS,
  purgeExpiredReportDraftVersions,
  reportDraftVersionCutoff,
} = await import('../src/services/reportDraftRetention.service.js');

describe('retención del historial de borradores', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calcula una retención de 30 días exactos', () => {
    const now = new Date('2026-11-05T12:00:00.000Z');
    expect(REPORT_DRAFT_VERSION_RETENTION_DAYS).toBe(30);
    expect(reportDraftVersionCutoff(now).toISOString()).toBe('2026-10-06T12:00:00.000Z');
  });

  it('elimina únicamente las versiones anteriores al límite', async () => {
    const now = new Date('2026-11-05T12:00:00.000Z');
    prisma.reportDraftVersion.deleteMany.mockResolvedValue({ count: 3 });

    await expect(purgeExpiredReportDraftVersions(prisma, now)).resolves.toEqual({ count: 3 });
    expect(prisma.reportDraftVersion.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date('2026-10-06T12:00:00.000Z') } },
    });
  });

  it('puede limitar la limpieza al borrador consultado', async () => {
    const now = new Date('2026-11-05T12:00:00.000Z');
    prisma.reportDraftVersion.deleteMany.mockResolvedValue({ count: 1 });

    await purgeExpiredReportDraftVersions(prisma, now, 9);
    expect(prisma.reportDraftVersion.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date('2026-10-06T12:00:00.000Z') }, draftId: 9 },
    });
  });
});
