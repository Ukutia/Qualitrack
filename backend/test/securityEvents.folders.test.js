import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/config/prisma.js', () => ({ prisma: {
  $transaction: vi.fn(), folder: { findMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  document: { findMany: vi.fn(), updateMany: vi.fn() }, securityEvent: { create: vi.fn() },
} }));
const { prisma } = await import('../src/config/prisma.js');
const { bulkTrashItems, deleteFolder } = await import('../src/controllers/folders.controller.js');
const user = { id: 1, email: 'admin@test.cl', role: 'admin' };
const res = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });
beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
  prisma.folder.findMany.mockResolvedValue([{ id: 2, parentId: null, createdById: 1 }]);
  prisma.document.findMany.mockResolvedValue([{ id: 8, analysisStatus: 'COMPLETED' }, { id: 9, analysisStatus: 'COMPLETED' }]);
  prisma.securityEvent.create.mockResolvedValue({});
});
it.each(['bulk', 'folder'])('la eliminación %s registra cada evidencia afectada y evita duplicados del middleware', async (mode) => {
  const req = { user, body: { folderIds: [2], documentIds: [8] }, params: { id: '2' }, query: { mode: 'trash' } };
  await (mode === 'bulk' ? bulkTrashItems(req, res()) : deleteFolder(req, res()));
  expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  expect(prisma.securityEvent.create.mock.calls.map(([arg]) => [arg.data.action, arg.data.resourceId])).toEqual([
    ['DOCUMENTS_TRASH_POST', '8'], ['DOCUMENTS_TRASH_POST', '9'], ['FOLDERS_DELETE', '2'],
  ]);
  expect(req.auditRecorded).toBe(true);
});
it('no confirma la eliminación si falla su auditoría transaccional', async () => {
  prisma.securityEvent.create.mockRejectedValue(new Error('Audit unavailable'));
  const req = { user, body: { documentIds: [8, 9] } };
  const response = res();
  await expect(bulkTrashItems(req, response)).rejects.toThrow('Audit unavailable');
  expect(response.json).not.toHaveBeenCalled();
  expect(req.auditRecorded).not.toBe(true);
});
