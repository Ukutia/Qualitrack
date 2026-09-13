import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/prisma.js', () => ({ prisma: {
  document: { count: vi.fn() },
  topic: { create: vi.fn() },
} }));
const { prisma } = await import('../src/config/prisma.js');
const { createTopic } = await import('../src/controllers/topics.controller.js');
const { canAccess } = await import('../src/config/roles.js');

beforeEach(() => vi.clearAllMocks());
function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('crear temáticas con documentos recién cargados', () => {
  it.each(['admin', 'user'])('permite crear al %s sin depender de chunks, vectorización o autor de la carga', async (role) => {
    prisma.document.count.mockResolvedValue(1);
    prisma.topic.create.mockResolvedValue({ id: 10, name: 'Calidad' });
    const res = response(), next = vi.fn();
    await createTopic({ user: { id: 7, role }, body: { name: '  Calidad  ' } }, res, next);
    // Query must count active repository documents, even when PROCESSING or
    // FAILED, and even when a different team member uploaded them.
    expect(prisma.document.count).toHaveBeenCalledWith({ where: { deletedAt: null } });
    expect(prisma.topic.create).toHaveBeenCalledWith({ data: { name: 'Calidad', createdById: 7 } });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });
  it('mantiene la validación cuando no existen documentos activos', async () => {
    prisma.document.count.mockResolvedValue(0);
    const res = response();
    await createTopic({ user: { id: 7, role: 'user' }, body: { name: 'Calidad' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.topic.create).not.toHaveBeenCalled();
  });
  it('rechaza nombres inválidos antes de consultar documentos', async () => {
    const res = response();
    await createTopic({ user: { id: 7, role: 'user' }, body: { name: 'ab' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.document.count).not.toHaveBeenCalled();
  });
  it('habilita ambas visualizaciones para calidad, sin habilitarlas al ingestor', () => {
    for (const [method, path] of [['POST', '/search/semantic'], ['GET', '/topics/network'], ['POST', '/topics'], ['DELETE', '/topics/1']]) {
      expect(canAccess('user', method, path)).toBe(true);
      expect(canAccess('ingestor', method, path)).toBe(false);
    }
  });
});
