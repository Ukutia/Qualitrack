// HU19 — Permisos personalizados por módulo.
// La resolución se prueba contra la app real (router + requireAuth +
// enforceRolePolicy) para que el 403 dependa de la política y no de un mock.
// Las rutas que la política deja pasar llegan al controlador con Prisma
// simulado y responden 200.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    userPermission: { findMany: vi.fn(), upsert: vi.fn() },
    // Auditoría HU20: registra cada 403.
    securityEvent: { create: vi.fn(async () => ({})) },
    // Lo que leen los controladores de las rutas permitidas en estas pruebas.
    reportDraft: { findMany: vi.fn() },
    topic: { findMany: vi.fn() },
    documentRequest: { findMany: vi.fn() },
  },
}));

const { prisma } = await import('../src/config/prisma.js');
const { createApp } = await import('../src/app.js');
const { signToken } = await import('../src/middleware/auth.js');
const { invalidatePermissions } = await import('../src/middleware/authorize.js');
const { MODULES, LEVELS, ROLE_TEMPLATES, findRoute, allows, effectivePermissions } =
  await import('../src/config/permissions.js');

let server;
let baseUrl;

beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

let nextUserId = 100;
let rows = [];

beforeEach(() => {
  vi.clearAllMocks();
  rows = [];
  prisma.userPermission.findMany.mockImplementation(async () => rows);
  prisma.reportDraft.findMany.mockResolvedValue([]);
  prisma.topic.findMany.mockResolvedValue([]);
  prisma.documentRequest.findMany.mockResolvedValue([]);
});

/** Usuario nuevo por prueba: el caché de permisos queda limpio. */
function member(role = 'user', saved = []) {
  const id = nextUserId++;
  rows = saved.map(([module, level]) => ({ module, level }));
  return { id, token: signToken({ id, email: `${role}${id}@qualitrack.cl`, name: role, role }) };
}

async function call(method, path, token, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* respuesta no JSON */ }
  return { status: response.status, body: json };
}

// Una ruta de lectura y una de escritura por módulo, tomadas del mapeo.
const SAMPLE = {
  [MODULES.TABLERO]: { read: ['GET', '/compliance'], write: ['POST', '/milestones'] },
  [MODULES.REPOSITORIO]: { read: ['GET', '/documents/trash'], write: ['POST', '/documents/4/trash'] },
  [MODULES.SOLICITUDES]: { read: ['GET', '/document-requests'], write: ['POST', '/document-requests'] },
  [MODULES.BUSQUEDA]: { read: ['GET', '/topics'], write: ['POST', '/topics'] },
  [MODULES.CARGA]: { read: ['GET', '/documents/4/stream'], write: ['POST', '/documents'] },
  [MODULES.INFORME]: { read: ['GET', '/report-drafts'], write: ['POST', '/report-drafts'] },
  [MODULES.NUBE]: { read: ['GET', '/cloud/google/status'], write: ['DELETE', '/cloud/google/disconnect'] },
};

/** Permisos con un único módulo concedido y el resto denegado. */
const only = (module, level) => ({
  ...Object.fromEntries(Object.values(MODULES).map((m) => [m, LEVELS.DENEGADO])),
  [module]: level,
});

describe('resolución por módulo y nivel', () => {
  describe.each(Object.entries(SAMPLE))('%s', (module, { read, write }) => {
    it('lectura habilita las rutas GET y no las de escritura', () => {
      const perms = only(module, LEVELS.LECTURA);
      expect(allows(perms, ...read)).toBe(true);
      if (write) expect(allows(perms, ...write)).toBe(false);
    });

    it('escritura habilita lectura y escritura', () => {
      const perms = only(module, LEVELS.ESCRITURA);
      expect(allows(perms, ...read)).toBe(true);
      if (write) expect(allows(perms, ...write)).toBe(true);
    });

    it('denegado bloquea todo el módulo', () => {
      const perms = only(module, LEVELS.DENEGADO);
      expect(allows(perms, ...read)).toBe(false);
      if (write) expect(allows(perms, ...write)).toBe(false);
    });
  });

  it('la búsqueda semántica es una consulta: basta lectura', () => {
    expect(allows(only(MODULES.BUSQUEDA, LEVELS.LECTURA), 'POST', '/search/semantic')).toBe(true);
  });

  it('conectar una nube exige escritura aunque sea un GET', () => {
    expect(allows(only(MODULES.NUBE, LEVELS.LECTURA), 'GET', '/cloud/google/auth-url')).toBe(false);
    expect(allows(only(MODULES.NUBE, LEVELS.ESCRITURA), 'GET', '/cloud/google/auth-url')).toBe(true);
  });

  it('una ruta compartida basta con cualquiera de sus módulos', () => {
    expect(allows(only(MODULES.BUSQUEDA, LEVELS.LECTURA), 'GET', '/documents/3/content')).toBe(true);
    expect(allows(only(MODULES.REPOSITORIO, LEVELS.LECTURA), 'GET', '/documents/3/content')).toBe(true);
    expect(allows(only(MODULES.NUBE, LEVELS.ESCRITURA), 'GET', '/documents/3/content')).toBe(false);
  });

  it('una ruta sin mapear se deniega aunque tenga escritura en todo', () => {
    const everything = effectivePermissions('user', Object.values(MODULES).map((module) => ({ module, level: 'escritura' })));
    expect(findRoute('GET', '/team/members')).toBeNull();
    expect(allows(everything, 'GET', '/team/members')).toBe(false);
    expect(allows(everything, 'GET', '/ruta/inventada')).toBe(false);
  });
});

describe('plantilla por defecto', () => {
  it('sin filas guardadas, el user conserva lo que su rol permitía', () => {
    expect(effectivePermissions('user')).toEqual(ROLE_TEMPLATES.user);
    expect(effectivePermissions('user')).toMatchObject({
      repositorio: 'escritura',
      solicitudes: 'escritura',
      carga: 'escritura',
      nube: 'escritura',
      tablero: 'escritura',
      busqueda: 'denegado',
      informe: 'denegado',
    });
  });

  it('el ingestor solo carga evidencia', () => {
    expect(effectivePermissions('ingestor')).toEqual({ ...only(MODULES.CARGA, LEVELS.ESCRITURA) });
  });

  it('una fila guardada reemplaza solo su módulo', () => {
    const perms = effectivePermissions('user', [{ module: 'informe', level: 'lectura' }]);
    expect(perms.informe).toBe('lectura');
    expect(perms.repositorio).toBe('escritura');
  });

  it('un rol desconocido no tiene nada', () => {
    expect(Object.values(effectivePermissions('auditor')).every((l) => l === 'denegado')).toBe(true);
  });

  it('el admin tiene escritura en todo y sus filas se ignoran', () => {
    const perms = effectivePermissions('admin', [{ module: 'informe', level: 'denegado' }]);
    expect(Object.values(perms).every((l) => l === 'escritura')).toBe(true);
  });
});

describe('URL directa con permisos mixtos (API real)', () => {
  it('permite lo concedido, rechaza lo denegado y usa la plantilla en lo demás', async () => {
    // Informe concedido en lectura, Repositorio denegado; Solicitudes sin fila
    // (plantilla de user: escritura) y Tablero denegado.
    const { token } = member('user', [['informe', 'lectura'], ['repositorio', 'denegado'], ['tablero', 'denegado']]);

    const allowed = await call('GET', '/report-drafts', token);
    expect(allowed.status).toBe(200);

    for (const [method, path] of [
      ['POST', '/report-drafts'],
      ['GET', '/documents/trash'],
      ['POST', '/documents/4/trash'],
      ['GET', '/compliance'],
    ]) {
      const denied = await call(method, path, token);
      expect(denied.status, `${method} ${path}`).toBe(403);
      expect(denied.body.error).toMatch(/Acceso denegado/);
    }

    const template = await call('GET', '/document-requests/config', token);
    expect(template.status).toBe(200);
  });

  it('una ruta sin mapear responde 403 sin cargar permisos', async () => {
    const { token } = member('user', [['repositorio', 'escritura']]);
    const res = await call('GET', '/team/members', token);
    expect(res.status).toBe(403);
    expect(prisma.userPermission.findMany).not.toHaveBeenCalled();
  });

  it('los permisos se cachean y se recargan al invalidar', async () => {
    const { id, token } = member('user', [['busqueda', 'denegado']]);
    expect((await call('GET', '/topics', token)).status).toBe(403);
    expect((await call('GET', '/topics', token)).status).toBe(403);
    expect(prisma.userPermission.findMany).toHaveBeenCalledTimes(1);

    rows = [{ module: 'busqueda', level: 'lectura' }];
    invalidatePermissions(id);
    expect((await call('GET', '/topics', token)).status).toBe(200);
  });

  it('/auth/me devuelve los permisos efectivos', async () => {
    const { token } = member('user', [['tablero', 'lectura']]);
    const res = await call('GET', '/auth/me', token);
    expect(res.status).toBe(200);
    expect(res.body.user.permissions).toMatchObject({ tablero: 'lectura', repositorio: 'escritura', informe: 'denegado' });
  });
});

describe('API de permisos de integrantes', () => {
  const target = { id: 7, name: 'Ana Soto', email: 'ana@x.cl', role: 'user', permissions: [] };

  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ ...target });
    prisma.userPermission.upsert.mockResolvedValue({});
  });

  it.each(['user', 'ingestor'])('el rol %s recibe 403 aunque tenga escritura en todos los módulos', async (role) => {
    const { token } = member(role, Object.values(MODULES).map((m) => [m, 'escritura']));
    for (const method of ['GET', 'PUT']) {
      const res = await call(method, '/team/members/7/permissions', token, method === 'PUT' ? { module: 'informe', level: 'escritura' } : undefined);
      expect(res.status).toBe(403);
    }
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.userPermission.upsert).not.toHaveBeenCalled();
  });

  it('GET devuelve la vista de permisos actuales con su origen', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...target, permissions: [{ module: 'informe', level: 'lectura' }] });
    const { token } = member('admin');
    const res = await call('GET', '/team/members/7/permissions', token);

    expect(res.status).toBe(200);
    expect(res.body.permissions).toHaveLength(7);
    expect(res.body.permissions.find((p) => p.module === 'informe')).toMatchObject({ level: 'lectura', source: 'personalizado', label: 'Informe' });
    expect(res.body.permissions.find((p) => p.module === 'repositorio')).toMatchObject({ level: 'escritura', source: 'rol' });
  });

  it.each(['lectura', 'escritura', 'denegado'])('PUT guarda "%s" y devuelve la vista actualizada', async (level) => {
    const { token } = member('admin');
    const res = await call('PUT', '/team/members/7/permissions', token, { module: 'busqueda', level });

    expect(res.status).toBe(200);
    expect(prisma.userPermission.upsert).toHaveBeenCalledWith({
      where: { userId_module: { userId: 7, module: 'busqueda' } },
      create: { userId: 7, module: 'busqueda', level },
      update: { level },
    });
    expect(res.body.permissions.find((p) => p.module === 'busqueda')).toMatchObject({ level, source: 'personalizado' });
  });

  it('guardar denegado bloquea de inmediato al integrante (invalida el caché)', async () => {
    const user = member('user');
    rows = [];
    prisma.user.findUnique.mockResolvedValue({ ...target, id: user.id });
    expect((await call('GET', '/document-requests', user.token)).status).toBe(200);

    const admin = member('admin');
    rows = [{ module: 'solicitudes', level: 'denegado' }];
    await call('PUT', `/team/members/${user.id}/permissions`, admin.token, { module: 'solicitudes', level: 'denegado' });

    expect((await call('GET', '/document-requests', user.token)).status).toBe(403);
  });

  it('valida módulo y nivel', async () => {
    const { token } = member('admin');
    const res = await call('PUT', '/team/members/7/permissions', token, { module: 'equipo', level: 'total' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['level', 'module']);
    expect(prisma.userPermission.upsert).not.toHaveBeenCalled();
  });

  it('responde 404 si el integrante no existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const { token } = member('admin');
    const res = await call('PUT', '/team/members/99/permissions', token, { module: 'informe', level: 'lectura' });
    expect(res.status).toBe(404);
    expect(prisma.userPermission.upsert).not.toHaveBeenCalled();
  });

  it('no permite personalizar a un administrador', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...target, role: 'admin' });
    const { token } = member('admin');
    const res = await call('PUT', '/team/members/7/permissions', token, { module: 'informe', level: 'denegado' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/administrador/);
    expect(prisma.userPermission.upsert).not.toHaveBeenCalled();
  });
});
