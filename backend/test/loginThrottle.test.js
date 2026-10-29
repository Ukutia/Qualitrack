// HU25 — Limitar intentos reiterados de ingreso con credenciales incorrectas.
// Se prueba el controlador de login con Prisma y bcrypt simulados: lo que
// interesa es cuándo se compara la contraseña, cómo cambia el contador y que
// el mensaje no permita enumerar cuentas.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    loginThrottle: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    loginAttempt: { create: vi.fn() },
    securityEvent: { create: vi.fn() },
  },
}));

vi.mock('bcryptjs', () => ({ default: { compare: vi.fn() } }));

const { prisma } = await import('../src/config/prisma.js');
const bcrypt = (await import('bcryptjs')).default;
const { config } = await import('../src/config/env.js');
const { login, LOGIN_FAILED_MESSAGE } = await import('../src/controllers/auth.controller.js');

const USER = { id: 1, name: 'Ana', email: 'ana@qualitrack.cl', passwordHash: 'hash-real', role: 'admin' };
const MINUTE = 60 * 1000;

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

async function attempt(email, password) {
  const res = mockRes();
  await login({ body: { email, password }, ip: '10.0.0.1' }, res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.loginThrottle.update.mockImplementation(async ({ where, data }) => ({ email: where.email, ...data }));
  prisma.loginAttempt.create.mockResolvedValue({});
  prisma.securityEvent.create.mockResolvedValue({});
});

describe('HU25 · escenario 1: sin bloqueo y bajo el límite', () => {
  it('no entrega un token si la auditoría de inicio de sesión falla', async () => {
    prisma.loginThrottle.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(USER);
    bcrypt.compare.mockResolvedValue(true);
    prisma.securityEvent.create.mockRejectedValue(new Error('DB unavailable'));
    await expect(attempt(USER.email, 'correcta')).rejects.toMatchObject({ status: 503 });
    expect(prisma.loginThrottle.upsert).not.toHaveBeenCalled();
  });
  it('concede el acceso con credenciales correctas y reinicia el contador', async () => {
    prisma.loginThrottle.findUnique.mockResolvedValue({ email: USER.email, failedCount: 3, lockedUntil: null });
    prisma.user.findFirst.mockResolvedValue(USER);
    bcrypt.compare.mockResolvedValue(true);

    const res = await attempt('  ANA@Qualitrack.cl ', 'correcta');

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0]).toMatchObject({ token: expect.any(String), user: { id: 1 } });
    expect(prisma.loginThrottle.findUnique).toHaveBeenCalledWith({ where: { email: 'ana@qualitrack.cl' } });
    expect(prisma.loginThrottle.update).toHaveBeenCalledWith({
      where: { email: 'ana@qualitrack.cl' },
      data: { failedCount: 0, lockedUntil: null },
    });
    expect(prisma.loginAttempt.create.mock.calls[0][0].data).toMatchObject({ success: true, locked: false });
    expect(prisma.securityEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: USER.id, actorEmail: USER.email, action: 'LOGIN', resourceType: 'account', resourceId: String(USER.id), result: 'SUCCESS' }) });
  });

  it('un bloqueo vencido no impide el acceso y se limpia', async () => {
    prisma.loginThrottle.findUnique.mockResolvedValue({
      email: USER.email,
      failedCount: 5,
      lockedUntil: new Date(Date.now() - MINUTE),
    });
    prisma.user.findFirst.mockResolvedValue(USER);
    bcrypt.compare.mockResolvedValue(true);

    const res = await attempt(USER.email, 'correcta');

    expect(res.status).not.toHaveBeenCalled();
    expect(prisma.loginThrottle.update).toHaveBeenCalledWith({
      where: { email: USER.email },
      data: { failedCount: 0, lockedUntil: null },
    });
  });
});

describe('HU25 · escenario 2: a un intento del límite', () => {
  it('rechaza, activa el bloqueo temporal y no revela si el correo existe', async () => {
    const before = Date.now();
    prisma.loginThrottle.findUnique.mockResolvedValue({
      email: USER.email,
      failedCount: config.loginMaxAttempts - 1,
      lockedUntil: null,
    });
    prisma.loginThrottle.upsert.mockResolvedValue({ email: USER.email, failedCount: config.loginMaxAttempts });
    prisma.user.findFirst.mockResolvedValue(USER);
    bcrypt.compare.mockResolvedValue(false);

    const res = await attempt(USER.email, 'incorrecta');

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: LOGIN_FAILED_MESSAGE });
    expect(prisma.loginThrottle.upsert.mock.calls[0][0].update).toEqual({ failedCount: { increment: 1 } });

    const lockCall = prisma.loginThrottle.update.mock.calls.find(([arg]) => arg.data.lockedUntil);
    const lockedUntil = lockCall[0].data.lockedUntil.getTime();
    expect(lockedUntil).toBeGreaterThanOrEqual(before + config.loginLockMinutes * MINUTE);
    expect(lockedUntil).toBeLessThanOrEqual(Date.now() + config.loginLockMinutes * MINUTE);
    expect(prisma.loginAttempt.create.mock.calls[0][0].data).toMatchObject({ success: false, locked: true });
    expect(prisma.securityEvent.create.mock.calls.map(([arg]) => arg.data.action)).toEqual(['LOGIN_INVALID_PASSWORD', 'ACCOUNT_LOCKED']);
    expect(prisma.securityEvent.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ actorId: USER.id, resourceId: String(USER.id), result: 'SUCCESS' }) });
  });

  it('bajo el límite solo incrementa el contador, sin bloquear', async () => {
    prisma.loginThrottle.findUnique.mockResolvedValue({ email: USER.email, failedCount: 1, lockedUntil: null });
    prisma.loginThrottle.upsert.mockResolvedValue({ email: USER.email, failedCount: 2 });
    prisma.user.findFirst.mockResolvedValue(USER);
    bcrypt.compare.mockResolvedValue(false);

    const res = await attempt(USER.email, 'incorrecta');

    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.loginThrottle.update).not.toHaveBeenCalled();
    expect(prisma.loginAttempt.create.mock.calls[0][0].data).toMatchObject({ success: false, locked: false });
    expect(prisma.securityEvent.create.mock.calls.map(([arg]) => arg.data.action)).toEqual(['LOGIN_INVALID_PASSWORD']);
  });

  it('tras un bloqueo vencido el contador parte de cero', async () => {
    prisma.loginThrottle.findUnique.mockResolvedValue({
      email: USER.email,
      failedCount: 5,
      lockedUntil: new Date(Date.now() - MINUTE),
    });
    prisma.user.findFirst.mockResolvedValue(USER);
    bcrypt.compare.mockResolvedValue(false);

    await attempt(USER.email, 'incorrecta');

    expect(prisma.loginThrottle.upsert).not.toHaveBeenCalled();
    expect(prisma.loginThrottle.update).toHaveBeenCalledTimes(1);
    expect(prisma.loginThrottle.update).toHaveBeenCalledWith({
      where: { email: USER.email },
      data: { failedCount: 1, lockedUntil: null },
    });
  });
});

describe('HU25 · escenario 3: bloqueo vigente', () => {
  const lockedUntil = new Date(Date.now() + 10 * MINUTE);

  beforeEach(() => {
    prisma.loginThrottle.findUnique.mockResolvedValue({ email: USER.email, failedCount: 5, lockedUntil });
  });

  it.each([
    ['contraseña correcta', 'correcta'],
    ['contraseña incorrecta', 'incorrecta'],
  ])('rechaza con %s sin llamar a bcrypt.compare', async (_label, password) => {
    const res = await attempt(USER.email, password);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: LOGIN_FAILED_MESSAGE });
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.securityEvent.create.mock.calls.map(([arg]) => arg.data.action)).toEqual(['LOGIN_BLOCKED']);
    expect(prisma.securityEvent.create.mock.calls[0][0].data.actorEmail).toBe(USER.email);
  });

  it('conserva la fecha de término del bloqueo (no la extiende)', async () => {
    await attempt(USER.email, 'incorrecta');

    expect(prisma.loginThrottle.update).not.toHaveBeenCalled();
    expect(prisma.loginThrottle.upsert).not.toHaveBeenCalled();
  });

  it('registra el intento sin guardar la contraseña', async () => {
    await attempt(USER.email, 'secreto-123');

    expect(prisma.loginAttempt.create).toHaveBeenCalledTimes(1);
    const { data } = prisma.loginAttempt.create.mock.calls[0][0];
    expect(data).toEqual({ email: USER.email, ip: '10.0.0.1', success: false, locked: true });
    expect(JSON.stringify(prisma.securityEvent.create.mock.calls)).not.toContain('secreto-123');
    expect(JSON.stringify(data)).not.toContain('secreto-123');
  });
});

describe('HU25 · correo inexistente', () => {
  it('compara contra un hash falso, cuenta el fallo y responde igual que una cuenta real', async () => {
    prisma.loginThrottle.findUnique.mockResolvedValue(null);
    prisma.loginThrottle.upsert.mockResolvedValue({ email: 'nadie@qualitrack.cl', failedCount: 1 });
    prisma.user.findFirst.mockResolvedValue(null);
    bcrypt.compare.mockResolvedValue(false);

    const ghost = await attempt('Nadie@Qualitrack.cl', 'lo-que-sea');
    expect(prisma.securityEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'LOGIN_UNKNOWN_ACCOUNT', actorEmail: 'nadie@qualitrack.cl', result: 'FAILURE' }) });

    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
    expect(bcrypt.compare.mock.calls[0][1]).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(prisma.loginThrottle.upsert.mock.calls[0][0].create).toEqual({
      email: 'nadie@qualitrack.cl',
      failedCount: 1,
    });

    // Misma respuesta que con un correo registrado y contraseña errónea.
    const ghostResponse = [ghost.status.mock.calls, ghost.json.mock.calls].map((c) => [...c]);
    vi.clearAllMocks();
    prisma.loginThrottle.findUnique.mockResolvedValue(null);
    prisma.loginThrottle.upsert.mockResolvedValue({ email: USER.email, failedCount: 1 });
    prisma.user.findFirst.mockResolvedValue(USER);
    bcrypt.compare.mockResolvedValue(false);
    const real = await attempt(USER.email, 'incorrecta');

    expect(ghostResponse).toEqual([real.status.mock.calls, real.json.mock.calls]);
    expect(prisma.securityEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'LOGIN_INVALID_PASSWORD', actorId: USER.id, result: 'FAILURE' }) });
  });

  it('también se bloquea al alcanzar el límite', async () => {
    prisma.loginThrottle.findUnique.mockResolvedValue(null);
    prisma.loginThrottle.upsert.mockResolvedValue({ email: 'nadie@qualitrack.cl', failedCount: config.loginMaxAttempts });
    prisma.user.findFirst.mockResolvedValue(null);
    bcrypt.compare.mockResolvedValue(false);

    await attempt('nadie@qualitrack.cl', 'x');

    expect(prisma.loginThrottle.update.mock.calls[0][0].data.lockedUntil).toBeInstanceOf(Date);
  });
});

it('también registra credenciales incompletas sin incrementar el contador', async () => {
  const res = await attempt(USER.email, '');
  expect(res.status).toHaveBeenCalledWith(400);
  expect(prisma.securityEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'LOGIN_MISSING_CREDENTIALS', actorEmail: USER.email, result: 'FAILURE' }) });
  expect(prisma.loginThrottle.upsert).not.toHaveBeenCalled();
});
