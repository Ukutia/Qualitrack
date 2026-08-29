// EP 1.1 · EP 1.2 — Política de acceso por rol.
// Lo que interesa probar es la tabla de permisos (denegación por defecto) y la
// pertenencia de documentos, que son las dos piezas que sostienen los criterios
// de aceptación de ambas historias.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    document: { findUnique: vi.fn() },
    association: { findUnique: vi.fn() },
  },
}));

const { prisma } = await import('../src/config/prisma.js');
const { ROLES, canAccess, isOwnerScoped } = await import('../src/config/roles.js');
const { enforceRolePolicy } = await import('../src/middleware/authorize.js');
const { requireOwnDocument, requireOwnAssociation, ownerFilter } = await import(
  '../src/middleware/ownership.js'
);

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

beforeEach(() => vi.clearAllMocks());

describe('tabla de permisos', () => {
  it('el admin accede a todas las rutas', () => {
    for (const [method, path] of [
      ['GET', '/documents'],
      ['POST', '/report-structure'],
      ['DELETE', '/report-drafts/3'],
      ['GET', '/compliance'],
    ]) {
      expect(canAccess(ROLES.ADMIN, method, path)).toBe(true);
    }
  });

  it('el ingestor solo puede cargar documentos y ver su sesión', () => {
    expect(canAccess(ROLES.INGESTOR, 'POST', '/documents')).toBe(true);
    expect(canAccess(ROLES.INGESTOR, 'GET', '/auth/me')).toBe(true);

    expect(canAccess(ROLES.INGESTOR, 'GET', '/documents')).toBe(false);
    expect(canAccess(ROLES.INGESTOR, 'GET', '/documents/1')).toBe(false);
    expect(canAccess(ROLES.INGESTOR, 'GET', '/compliance')).toBe(false);
    expect(canAccess(ROLES.INGESTOR, 'GET', '/report-drafts')).toBe(false);
    expect(canAccess(ROLES.INGESTOR, 'POST', '/cloud/google/import')).toBe(false);
  });

  it('el user hereda al ingestor y suma nube, revisión y detalle', () => {
    expect(canAccess(ROLES.USER, 'POST', '/documents')).toBe(true);
    expect(canAccess(ROLES.USER, 'GET', '/documents/12')).toBe(true);
    expect(canAccess(ROLES.USER, 'POST', '/documents/12/classify')).toBe(true);
    expect(canAccess(ROLES.USER, 'PUT', '/documents/12/association')).toBe(true);
    expect(canAccess(ROLES.USER, 'POST', '/associations/4/validate')).toBe(true);
    expect(canAccess(ROLES.USER, 'POST', '/associations/4/reject')).toBe(true);
    expect(canAccess(ROLES.USER, 'POST', '/cloud/dropbox/import')).toBe(true);
    expect(canAccess(ROLES.USER, 'GET', '/criteria')).toBe(true);
  });

  it('el user no accede al informe ni a la estructura', () => {
    expect(canAccess(ROLES.USER, 'GET', '/report-drafts')).toBe(false);
    expect(canAccess(ROLES.USER, 'PUT', '/report-drafts/1')).toBe(false);
    expect(canAccess(ROLES.USER, 'POST', '/report-structure')).toBe(false);
    expect(canAccess(ROLES.USER, 'GET', '/documents/trash')).toBe(false);
    expect(canAccess(ROLES.USER, 'DELETE', '/documents/9')).toBe(false);
  });

  it('un rol desconocido no accede a nada', () => {
    expect(canAccess('auditor', 'GET', '/documents')).toBe(false);
    expect(canAccess(undefined, 'POST', '/documents')).toBe(false);
  });
});

describe('enforceRolePolicy', () => {
  it('deja pasar lo permitido', () => {
    const next = vi.fn();
    const res = mockRes();
    enforceRolePolicy({ user: { role: ROLES.INGESTOR }, method: 'POST', path: '/documents' }, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responde 403 con mensaje de acceso denegado', () => {
    const next = vi.fn();
    const res = mockRes();
    enforceRolePolicy({ user: { role: ROLES.INGESTOR }, method: 'GET', path: '/compliance' }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0]).toMatchObject({ code: 'FORBIDDEN_ROLE' });
    expect(res.json.mock.calls[0][0].error).toMatch(/Acceso denegado/i);
  });

  it('no consulta la base de datos para denegar', () => {
    enforceRolePolicy({ user: { role: ROLES.USER }, method: 'GET', path: '/report-drafts' }, mockRes(), vi.fn());
    expect(prisma.document.findUnique).not.toHaveBeenCalled();
  });
});

describe('pertenencia de documentos', () => {
  it('solo el admin ve el repositorio completo', () => {
    expect(ownerFilter({ id: 7, role: ROLES.ADMIN })).toEqual({});
    expect(ownerFilter({ id: 7, role: ROLES.USER })).toEqual({ uploadedById: 7 });
    expect(isOwnerScoped(ROLES.INGESTOR)).toBe(true);
  });

  it('el user pasa sobre su propio documento', async () => {
    prisma.document.findUnique.mockResolvedValue({ uploadedById: 7 });
    const next = vi.fn();
    const res = mockRes();
    await requireOwnDocument({ user: { id: 7, role: ROLES.USER }, params: { id: '3' } }, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('el documento de otro usuario responde Acceso denegado', async () => {
    prisma.document.findUnique.mockResolvedValue({ uploadedById: 99 });
    const next = vi.fn();
    const res = mockRes();
    await requireOwnDocument({ user: { id: 7, role: ROLES.USER }, params: { id: '3' } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].error).toMatch(/Acceso denegado/i);
  });

  it('un documento inexistente sigue siendo 404', async () => {
    prisma.document.findUnique.mockResolvedValue(null);
    const res = mockRes();
    await requireOwnDocument({ user: { id: 7, role: ROLES.USER }, params: { id: '3' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('el admin no gasta consultas de pertenencia', async () => {
    const next = vi.fn();
    await requireOwnDocument({ user: { id: 1, role: ROLES.ADMIN }, params: { id: '3' } }, mockRes(), next);
    expect(prisma.document.findUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('bloquea validar la propuesta de un documento ajeno', async () => {
    prisma.association.findUnique.mockResolvedValue({ document: { uploadedById: 99 } });
    const next = vi.fn();
    const res = mockRes();
    await requireOwnAssociation({ user: { id: 7, role: ROLES.USER }, params: { id: '5' } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
