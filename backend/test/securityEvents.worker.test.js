import { beforeEach, expect, it, vi } from 'vitest';
import { once } from 'node:events';
vi.mock('../src/config/prisma.js', () => ({ prisma: {
  $transaction: vi.fn(), $queryRaw: vi.fn(), document: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() }, securityEvent: { create: vi.fn() },
  association: { create: vi.fn() }, associationHistory: { create: vi.fn() },
} }));
vi.mock('../src/services/analysisEvents.service.js', () => ({ publishAnalysisStatus: vi.fn(), subscribeAnalysisStatus: vi.fn() }));
const { prisma } = await import('../src/config/prisma.js');
const { createApp } = await import('../src/app.js');
const { publishAnalysisStatus } = await import('../src/services/analysisEvents.service.js');
beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
  prisma.document.findUnique.mockResolvedValue({ analysisStatus: 'ANALYZING_CONTENT' });
  prisma.user.findUnique.mockResolvedValue({ id: 4, email: 'cuenta@test.cl' });
  prisma.securityEvent.create.mockResolvedValue({});
});
async function callback(body, token = 'worker-test-secret') {
  const previous = process.env.WORKER_WEBHOOK_SECRET;
  process.env.WORKER_WEBHOOK_SECRET = 'worker-test-secret';
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/webhooks/worker-update`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-worker-token': token }, body: JSON.stringify({ documentId: 8, userId: 4, ...body }) });
    return { status: response.status, body: await response.text() };
  } finally {
    if (previous === undefined) delete process.env.WORKER_WEBHOOK_SECRET; else process.env.WORKER_WEBHOOK_SECRET = previous;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
it('el webhook autentica al worker y guarda el resultado y auditoría en una transacción', async () => {
  expect((await callback({ status: 'COMPLETED', result: { relevant: false } })).status).toBe(200);
  expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  expect(prisma.securityEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: 4, action: 'CLASSIFICATION_COMPLETED', resourceId: '8' }) });
  expect(publishAnalysisStatus).toHaveBeenCalledTimes(1);
});
it('una devolución duplicada no crea eventos ni cambia el documento', async () => {
  prisma.document.findUnique.mockResolvedValue({ analysisStatus: 'COMPLETED' });
  expect(await callback({ status: 'COMPLETED' })).toEqual({ status: 200, body: 'IGNORED' });
  expect(prisma.document.update).not.toHaveBeenCalled();
  expect(prisma.securityEvent.create).not.toHaveBeenCalled();
});
it('un emisor no autorizado no puede introducir eventos', async () => {
  expect((await callback({ status: 'COMPLETED' }, 'incorrecto')).status).toBe(401);
  expect(prisma.$transaction).not.toHaveBeenCalled();
  expect(prisma.securityEvent.create).not.toHaveBeenCalled();
});
it('un fallo de auditoría no publica ni confirma el resultado', async () => {
  prisma.securityEvent.create.mockRejectedValue(new Error('Audit unavailable'));
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect((await callback({ status: 'ERROR' })).status).toBe(500);
    expect(publishAnalysisStatus).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); }
});
