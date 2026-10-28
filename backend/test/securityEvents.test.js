import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { once } from 'node:events';
vi.mock('../src/config/prisma.js', () => ({ prisma: { securityEvent: { create: vi.fn() }, userPermission: { findMany: vi.fn(async () => []) } } }));
const { prisma } = await import('../src/config/prisma.js');
const { recordSecurityEvent } = await import('../src/services/audit.service.js');
const { auditRequests, sensitiveAction } = await import('../src/middleware/audit.js');
const { enforceRolePolicy, invalidatePermissions } = await import('../src/middleware/authorize.js');
const { canAccess } = await import('../src/config/permissions.js');
beforeEach(() => { vi.clearAllMocks(); invalidatePermissions(2); prisma.userPermission.findMany.mockResolvedValue([]); prisma.securityEvent.create.mockResolvedValue({ id: 1 }); });

async function request({ method = 'GET', path = '/security-events', role = 'user', status = 200, body = { id: 5 }, endOnly = false, alreadyRecorded = false } = {}) {
  const app = express();
  app.use((req, res, next) => { req.user = { id: 2, email: 'test@test.cl', role }; next(); });
  app.use(auditRequests, enforceRolePolicy);
  app.use((req, res) => { req.auditRecorded = alreadyRecorded; return status === 204 ? endOnly ? res.status(204).end() : res.status(204).send() : res.status(status).json(body); });
  app.use((error, req, res, next) => res.status(500).json({ error: 'Audit unavailable' }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method }); return { status: response.status, body: response.status === 204 ? null : await response.json() }; }
  finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}

describe('auditoría de seguridad HU20', () => {
  it('no permite al equipo ni al ingestor consultar el registro', () => {
    expect(canAccess('user', 'GET', '/security-events')).toBe(false);
    expect(canAccess('ingestor', 'GET', '/security-events')).toBe(false);
    expect(canAccess('admin', 'GET', '/security-events')).toBe(true);
    expect(canAccess('ingestor', 'POST', '/milestones')).toBe(false);
    expect(canAccess('user', 'POST', '/milestones/7/complete')).toBe(true);
  });
  it('registra el rechazo antes de responder Acceso Denegado', async () => {
    const response = await request();
    expect(response).toMatchObject({ status: 403, body: { error: 'Acceso Denegado' } });
    expect(prisma.securityEvent.create.mock.calls[0][0].data).toMatchObject({ actorId: 2, action: 'ACCESS_DENIED', result: 'DENIED', resourceType: 'GET /security-events' });
  });
  it('registra la creación con el identificador y el resultado', async () => {
    await request({ method: 'POST', path: '/documents', status: 201 });
    expect(prisma.securityEvent.create.mock.calls[0][0].data).toMatchObject({ action: 'DOCUMENTS_POST', resourceId: '5', result: 'SUCCESS' });
  });
  it('también registra eliminaciones que responden sin contenido', async () => {
    expect((await request({ method: 'DELETE', path: '/document-requests/5', status: 204 })).status).toBe(204);
    expect(prisma.securityEvent.create).toHaveBeenCalledTimes(1);
  });
  it('un fallo del registro no se oculta como éxito', async () => {
    prisma.securityEvent.create.mockRejectedValue(new Error('Database unavailable'));
    expect((await request({ method: 'POST', path: '/documents' })).status).toBe(500);
  });
  it('excluye secretos y contenido del documento', async () => {
    await recordSecurityEvent({ user: { id: 2, email: 'test@test.cl', password: 'secret' }, action: 'LOGIN', resourceType: 'account', password: 'secret', token: 'secret', body: { content: 'confidential' } });
    expect(JSON.stringify(prisma.securityEvent.create.mock.calls[0][0])).not.toMatch(/secret|confidential/);
  });
  it('usuarios del mismo rol producen resultados distintos según sus permisos guardados', async () => {
    prisma.userPermission.findMany.mockResolvedValue([{ module: 'carga', level: 'denegado' }]);
    expect((await request({ method: 'POST', path: '/documents' })).status).toBe(403);
    expect(prisma.securityEvent.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'ACCESS_DENIED', actorId: 2, actorEmail: 'test@test.cl', result: 'DENIED' }) }));
    invalidatePermissions(2);
    prisma.userPermission.findMany.mockResolvedValue([{ module: 'carga', level: 'escritura' }]);
    expect((await request({ method: 'POST', path: '/documents' })).status).toBe(200);
    expect(prisma.securityEvent.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'DOCUMENTS_POST', result: 'SUCCESS' }) }));
  });
  it('lectura permite consultar, pero registra en rojo el intento de escritura', async () => {
    prisma.userPermission.findMany.mockResolvedValue([{ module: 'informe', level: 'lectura' }]);
    expect((await request({ path: '/report-drafts' })).status).toBe(200);
    expect(prisma.securityEvent.create).not.toHaveBeenCalled();
    expect((await request({ method: 'PUT', path: '/report-drafts/7/sections/4' })).status).toBe(403);
    expect(prisma.securityEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ resourceId: '7/4', result: 'DENIED' }) });
  });
  it.each([
    ['POST', '/document-requests', 'DOCUMENT_REQUESTS_POST'],
    ['POST', '/documents', 'DOCUMENTS_POST'],
    ['POST', '/documents/5/classify', 'DOCUMENTS_CLASSIFY_POST'],
    ['POST', '/associations/8/validate', 'ASSOCIATIONS_VALIDATE_POST'],
    ['POST', '/documents/5/trash', 'DOCUMENTS_TRASH_POST'],
    ['DELETE', '/documents/5', 'DOCUMENTS_DELETE'],
    ['PUT', '/report-drafts/5', 'REPORT_DRAFTS_PUT'],
    ['PUT', '/report-drafts/5/sections/3', 'REPORT_DRAFTS_SECTIONS_PUT'],
    ['PUT', '/team/members/5/permissions', 'PERMISSIONS_UPDATED'],
    ['POST', '/milestones', 'MILESTONES_POST'],
    ['PUT', '/milestones/5', 'MILESTONES_PUT'],
    ['POST', '/folders/bulk-trash', 'FOLDERS_BULK_TRASH_POST'],
  ])('cubre la operación sensible %s %s', async (method, path, action) => {
    expect(sensitiveAction(method, path)).toBe(action);
    expect((await request({ method, path, role: 'admin' })).status).toBe(200);
    expect(prisma.securityEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.securityEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action, result: 'SUCCESS' }) });
  });
  it('captura rechazos de pertenencia aunque el módulo esté habilitado', async () => {
    expect((await request({ method: 'POST', path: '/documents/9/trash', status: 403 })).status).toBe(403);
    expect(prisma.securityEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ result: 'DENIED', resourceId: '9' }) });
  });
  it('captura respuestas end sin contenido', async () => {
    expect((await request({ method: 'DELETE', path: '/documents/5', status: 204, endOnly: true })).status).toBe(204);
    expect(prisma.securityEvent.create).toHaveBeenCalledTimes(1);
  });
  it('distingue una clasificación aceptada de su resultado final', async () => {
    await request({ method: 'POST', path: '/documents/5/classify', status: 202 });
    expect(prisma.securityEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'DOCUMENTS_CLASSIFY_POST', result: 'ACCEPTED' }) });
  });
  it('no duplica la auditoría que el controlador ya guardó en su transacción', async () => {
    await request({ method: 'POST', path: '/milestones', alreadyRecorded: true });
    expect(prisma.securityEvent.create).not.toHaveBeenCalled();
  });
});
