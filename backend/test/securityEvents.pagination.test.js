import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/config/prisma.js', () => ({ prisma: { $transaction: vi.fn(), securityEvent: { count: vi.fn(), findMany: vi.fn() } } }));
const { prisma } = await import('../src/config/prisma.js');
const { listSecurityEvents } = await import('../src/controllers/securityEvents.controller.js');
beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
  prisma.securityEvent.findMany.mockResolvedValue([{ id: 11 }]);
});
it('consulta la segunda página con diez filas y mantiene un orden estable', async () => {
  prisma.securityEvent.count.mockResolvedValue(31);
  const res = { json: vi.fn() };
  await listSecurityEvents({ query: { page: '2', pageSize: '10' } }, res);
  expect(prisma.securityEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }));
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 10, total: 31, totalPages: 4 }));
});
it('conserva el filtro de denegaciones al paginar y ajusta páginas fuera de rango', async () => {
  prisma.securityEvent.count.mockResolvedValue(12);
  const res = { json: vi.fn() };
  await listSecurityEvents({ query: { page: '99', pageSize: '10', result: 'DENIED' } }, res);
  expect(prisma.securityEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { result: 'DENIED' }, skip: 10, take: 10 }));
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ page: 2, totalPages: 2 }));
});
it('una colección vacía y tamaños no admitidos mantienen una página válida', async () => {
  prisma.securityEvent.count.mockResolvedValue(0);
  const res = { json: vi.fn() };
  await listSecurityEvents({ query: { page: '-2', pageSize: '9999' } }, res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 50, totalPages: 1, total: 0 }));
  expect(prisma.securityEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 50 }));
});
