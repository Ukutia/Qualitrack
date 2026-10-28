import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { once } from 'node:events';
vi.mock('../src/config/prisma.js', () => ({ prisma: { securityEvent: { create: vi.fn() }, userPermission: { findMany: vi.fn(async () => []) } } }));
const { prisma } = await import('../src/config/prisma.js');
const { recordSecurityEvent } = await import('../src/services/audit.service.js');
const { auditRequests } = await import('../src/middleware/audit.js');
const { enforceRolePolicy } = await import('../src/middleware/authorize.js');
const { canAccess } = await import('../src/config/permissions.js');
beforeEach(() => { vi.clearAllMocks(); prisma.securityEvent.create.mockResolvedValue({ id: 1 }); });

async function request({ method = 'GET', path = '/security-events', role = 'user', status = 200, body = { id: 5 } } = {}) {
  const app = express();
  app.use((req, res, next) => { req.user = { id: 2, email: 'test@test.cl', role }; next(); });
  app.use(auditRequests, enforceRolePolicy);
  app.use((req, res) => status === 204 ? res.status(204).send() : res.status(status).json(body));
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
});
