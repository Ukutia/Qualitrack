// HU18 — Incorporación de integrantes al equipo.
// Se prueba contra la app real (router + requireAuth + enforceRolePolicy) para
// que el 403 de user/ingestor dependa de la política de roles y no de un mock.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    userPermission: { upsert: vi.fn() },
    cloudConnection: { deleteMany: vi.fn() },
    loginThrottle: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
    // Auditoría HU20: registra cada 403.
    securityEvent: { create: vi.fn(async () => ({})) },
  },
}));
vi.mock('../src/services/requestEmail.service.js', async (importOriginal) => ({
  ...(await importOriginal()),
  sendTeamWelcomeEmail: vi.fn(),
}));

const { prisma } = await import('../src/config/prisma.js');
const { sendTeamWelcomeEmail } = await import('../src/services/requestEmail.service.js');
const { createApp } = await import('../src/app.js');
const { signToken } = await import('../src/middleware/auth.js');
const { validateMemberInput } = await import('../src/controllers/team.controller.js');

let server;
let baseUrl;

beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
  prisma.user.findUnique.mockResolvedValue(null);
  prisma.user.create.mockImplementation(async ({ data }) => ({
    id: 40,
    name: data.name,
    email: data.email,
    cargo: data.cargo,
    role: data.role,
    createdAt: new Date('2026-10-22T12:00:00Z'),
  }));
  sendTeamWelcomeEmail.mockResolvedValue({ messageId: 'ok' });
});

const tokenFor = (role) => signToken({ id: 1, email: `${role}@qualitrack.cl`, name: role, role });

async function call(method, role, body, path = '/team/members') {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenFor(role)}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

const VALID = {
  email: 'Maria.Perez@Institucion.CL',
  nombre: 'María José Peña',
  cargo: 'Analista de Calidad',
  rol: 'user',
};

describe('POST /team/members', () => {
  it('concede el acceso con el rol elegido y notifica sin pedir aceptación', async () => {
    const { status, body } = await call('POST', 'admin', VALID);

    expect(status).toBe(201);
    expect(body.member).toMatchObject({
      email: 'maria.perez@institucion.cl',
      name: 'María José Peña',
      cargo: 'Analista de Calidad',
      role: 'user',
    });
    expect(body.notification).toEqual({ sent: true });

    const { data } = prisma.user.create.mock.calls[0][0];
    expect(data.passwordHash).toMatch(/^\$2[aby]\$10\$/);

    const email = sendTeamWelcomeEmail.mock.calls[0][0];
    expect(email).toMatchObject({
      recipientEmail: 'maria.perez@institucion.cl',
      roleLabel: 'Miembro del equipo de aseguramiento de calidad',
    });
    expect(email.temporaryPassword.length).toBeGreaterThanOrEqual(12);
    expect(email.loginUrl).toMatch(/\/login$/);
  });

  it('si el correo falla, el usuario queda creado y la respuesta lo informa', async () => {
    sendTeamWelcomeEmail.mockRejectedValue(new Error('SMTP caído'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { status, body } = await call('POST', 'admin', VALID);

    expect(status).toBe(201);
    expect(prisma.user.create).toHaveBeenCalled();
    expect(body.notification.sent).toBe(false);
    expect(body.notification.error).toMatch(/no se pudo enviar el correo/i);
    expect(body.notification.temporaryPassword).toBeTruthy();
    // La contraseña nunca se escribe en los logs.
    const logged = errorLog.mock.calls.flat().join(' ');
    expect(logged).not.toContain(body.notification.temporaryPassword);
    errorLog.mockRestore();
  });

  it.each([
    ['email', { email: 'maria.perez@' }],
    ['email', { email: 'maria perez@institucion.cl' }],
    ['email', { email: 'maria..perez@institucion.cl' }],
    ['nombre', { nombre: 'María 2' }],
    ['nombre', { nombre: 'María_Peña' }],
    ['cargo', { cargo: 'Analista #1' }],
    ['cargo', { cargo: '' }],
  ])('rechaza indicando el campo %s cuando es inválido (%o)', async (field, override) => {
    const { status, body } = await call('POST', 'admin', { ...VALID, ...override });

    expect(status).toBe(400);
    expect(Object.keys(body.errors)).toEqual([field]);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(sendTeamWelcomeEmail).not.toHaveBeenCalled();
  });

  it('informa todos los campos inválidos a la vez', async () => {
    const { status, body } = await call('POST', 'admin', {
      email: 'no-es-correo',
      nombre: 'Juan123',
      cargo: 'Jefe/a',
      rol: 'superadmin',
    });

    expect(status).toBe(400);
    expect(Object.keys(body.errors).sort()).toEqual(['cargo', 'email', 'nombre', 'rol']);
    expect(body.errors.email).toMatch(/estructura válida/);
    expect(body.errors.nombre).toMatch(/solo puede contener letras/);
    expect(body.errors.cargo).toMatch(/solo puede contener letras/);
  });

  it('rechaza un correo ya registrado con error en el campo email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 3 });

    const { status, body } = await call('POST', 'admin', VALID);

    expect(status).toBe(409);
    expect(body.errors).toEqual({ email: expect.stringMatching(/ya pertenece/) });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'maria.perez@institucion.cl' } })
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('trata un alta concurrente del mismo correo como duplicado', async () => {
    prisma.user.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

    const { status, body } = await call('POST', 'admin', VALID);

    expect(status).toBe(409);
    expect(body.errors.email).toBeTruthy();
  });
});

describe('acceso a la sección de equipo', () => {
  it.each(['user', 'ingestor'])('el rol %s recibe 403 y no toca la base de datos', async (role) => {
    for (const method of ['GET', 'POST']) {
      const { status, body } = await call(method, role, method === 'POST' ? VALID : undefined);
      expect(status).toBe(403);
      expect(body.code).toBe('FORBIDDEN_ROLE');
    }
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('el admin obtiene el listado de integrantes', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 1, name: 'Ana', email: 'ana@x.cl', cargo: 'Jefa', role: 'admin' }]);

    const { status, body } = await call('GET', 'admin');

    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null });
    expect(prisma.user.findMany.mock.calls[0][0].select).not.toHaveProperty('passwordHash');
  });
});

describe('DELETE /team/members/:id', () => {
  const target = {
    id: 23,
    name: 'Ana Soto',
    email: 'ana@institucion.cl',
    role: 'user',
    deletedAt: null,
    permissions: [],
  };

  it('exige escribir exactamente “entiendo”', async () => {
    const { status, body } = await call('DELETE', 'admin', { confirmation: 'Entiendo' }, '/team/members/23');

    expect(status).toBe(400);
    expect(body.code).toBe('CONFIRMATION_REQUIRED');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('impide eliminar administradores', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...target, role: 'admin' });

    const { status, body } = await call('DELETE', 'admin', { confirmation: 'entiendo' }, '/team/members/23');

    expect(status).toBe(400);
    expect(body.error).toMatch(/administradores no se pueden eliminar/i);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('elimina lógicamente, libera el correo, revoca permisos y registra a quién se eliminó', async () => {
    prisma.user.findUnique.mockResolvedValue(target);
    prisma.user.update.mockResolvedValue({});
    prisma.userPermission.upsert.mockResolvedValue({});
    prisma.cloudConnection.deleteMany.mockResolvedValue({ count: 1 });
    prisma.loginThrottle.deleteMany.mockResolvedValue({ count: 1 });

    const { status, body } = await call('DELETE', 'admin', { confirmation: 'entiendo' }, '/team/members/23');

    expect(status).toBe(200);
    expect(body.deleted).toMatchObject({ id: 23, name: 'Ana Soto', email: 'ana@institucion.cl' });
    expect(prisma.userPermission.upsert).toHaveBeenCalledTimes(7);
    expect(prisma.userPermission.upsert.mock.calls.every(([args]) => args.create.level === 'denegado' && args.update.level === 'denegado')).toBe(true);
    expect(prisma.cloudConnection.deleteMany).toHaveBeenCalledWith({ where: { userId: 23 } });
    expect(prisma.loginThrottle.deleteMany).toHaveBeenCalledWith({ where: { email: 'ana@institucion.cl' } });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 23 },
      data: expect.objectContaining({
        email: expect.stringMatching(/^deleted-23-[a-f0-9]+@deleted\.qualitrack\.local$/),
        deletedEmail: 'ana@institucion.cl',
        deletedAt: expect.any(Date),
        passwordHash: expect.stringMatching(/^\$2[aby]\$10\$/),
      }),
    });
    expect(prisma.securityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorEmail: 'admin@qualitrack.cl',
        action: 'TEAM_MEMBER_DELETED',
        resourceType: 'team-member',
        resourceId: '23 · Ana Soto · ana@institucion.cl',
        result: 'SUCCESS',
      }),
    });
  });

  it.each(['user', 'ingestor'])('el rol %s no puede eliminar integrantes', async (role) => {
    const { status } = await call('DELETE', role, { confirmation: 'entiendo' }, '/team/members/23');
    expect(status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('validateMemberInput', () => {
  it('acepta tildes, ñ y diéresis y normaliza espacios', () => {
    const { values, errors } = validateMemberInput({
      email: '  ANA.Soto@Ejemplo.CL ',
      nombre: '  Begoña   Güell  ',
      cargo: 'Coordinadora Académica',
      rol: 'ingestor',
    });
    expect(errors).toEqual({});
    expect(values).toEqual({
      email: 'ana.soto@ejemplo.cl',
      nombre: 'Begoña Güell',
      cargo: 'Coordinadora Académica',
      rol: 'ingestor',
    });
  });
});
