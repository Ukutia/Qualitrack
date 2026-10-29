import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/config/prisma.js', () => ({ prisma: {
  userPermission: { findMany: vi.fn() }, securityEvent: { create: vi.fn() },
} }));
const { prisma } = await import('../src/config/prisma.js');
const { invalidatePermissions } = await import('../src/middleware/authorize.js');
const { recordDeniedNavigation } = await import('../src/controllers/securityEvents.controller.js');
const user = { id: 31, email: 'persona@qualitrack.cl', role: 'user' };
beforeEach(() => { vi.clearAllMocks(); invalidatePermissions(user.id); prisma.userPermission.findMany.mockResolvedValue([]); });
async function navigate(section, account = user) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };
  await recordDeniedNavigation({ body: { section }, user: account }, res);
  return res;
}
it.each(['/requests/new', '/upload'])('reconoce que %s exige escritura, aunque permita lectura', async (section) => {
  prisma.userPermission.findMany.mockResolvedValue([{ module: 'solicitudes', level: 'lectura' }, { module: 'carga', level: 'lectura' }]);
  expect((await navigate(section)).status).toHaveBeenCalledWith(204);
  expect(prisma.securityEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: user.id, resourceId: section, action: 'ACCESS_DENIED', result: 'DENIED' }) });
});
it('no permite inventar un rechazo donde el usuario sí tiene acceso', async () => {
  expect((await navigate('/requests')).status).toHaveBeenCalledWith(400);
  expect(prisma.securityEvent.create).not.toHaveBeenCalled();
});
it.each(['/security-events', '/team'])('registra el acceso restringido a %s aunque tenga escritura en todos los módulos', async (section) => {
  prisma.userPermission.findMany.mockResolvedValue(['tablero', 'repositorio', 'solicitudes', 'carga', 'busqueda', 'informe', 'nube'].map((module) => ({ module, level: 'escritura' })));
  expect((await navigate(section)).status).toHaveBeenCalledWith(204);
  expect(prisma.securityEvent.create).toHaveBeenCalledTimes(1);
});
it('no genera eventos falsos para el encargado', async () => {
  expect((await navigate('/security-events', { ...user, role: 'admin' })).status).toHaveBeenCalledWith(400);
  expect(prisma.securityEvent.create).not.toHaveBeenCalled();
});
it.each([null, {}, '/desconocida', '/cloud?token=secreto', '/documents/../../auth'])('rechaza secciones no verificables: %j', async (section) => {
  expect((await navigate(section)).status).toHaveBeenCalledWith(400);
  expect(prisma.securityEvent.create).not.toHaveBeenCalled();
});
