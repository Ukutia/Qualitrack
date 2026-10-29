// Manual local integration check: real HTTP + PostgreSQL, no mocked controllers.
// Creates only uniquely named disposable accounts, then removes its own data.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma.js';
import { config } from '../src/config/env.js';

if (config.nodeEnv === 'production') throw new Error('Esta prueba solo se ejecuta en desarrollo local.');
const base = new URL(process.env.HU20_SMOKE_API_URL || `http://127.0.0.1:${config.port}/api/`);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) throw new Error('La prueba solo permite HTTP local.');
assert(config.loginMaxAttempts <= 20, 'El límite de intentos configurado es demasiado alto para esta prueba.');
const tag = crypto.randomUUID();
const email = `hu20-${tag}@example.invalid`;
const unknown = `hu20-unknown-${tag}@example.invalid`;
const password = crypto.randomBytes(24).toString('base64url');
let account;
async function call(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(new URL(path, base), { method, signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
try {
  // A container marked "Started" may still be migrating/seeding. Wait for
  // the API before creating any test data; never retry credential submissions.
  const deadline = Date.now() + 45000;
  let healthy = false;
  while (Date.now() < deadline) {
    try { healthy = (await fetch(new URL('health', base), { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Still starting. */ }
    if (healthy) break;
    await delay(500);
  }
  assert(healthy, 'El backend local no está listo en /api/health.');
  account = await prisma.user.create({ data: { name: 'Prueba temporal auditoría HU20', email, role: 'admin', passwordHash: await bcrypt.hash(password, 10) } });
  const success = await call('auth/login', { method: 'POST', body: { email, password } });
  assert.equal(success.status, 200);
  const token = success.body.token; // Used in memory only; never printed or saved.
  assert.equal((await call('auth/login', { method: 'POST', body: { email, password: '' } })).status, 400);
  let publicError;
  for (let i = 0; i < config.loginMaxAttempts; i++) {
    const failed = await call('auth/login', { method: 'POST', body: { email, password: `${password}-incorrecta` } });
    assert.equal(failed.status, 401);
    publicError = failed.body.error;
  }
  const locked = await prisma.loginThrottle.findUnique({ where: { email } });
  assert(locked.lockedUntil > new Date(), 'No se activó el bloqueo real.');
  const blocked = await call('auth/login', { method: 'POST', body: { email, password } });
  assert.equal(blocked.status, 401, 'La cuenta bloqueada no debe entrar ni con su contraseña correcta.');
  assert.equal(blocked.body.error, publicError);
  const ghost = await call('auth/login', { method: 'POST', body: { email: unknown, password } });
  assert.equal(ghost.status, 401);
  assert.equal(ghost.body.error, publicError);
  const audit = await call('security-events?category=authentication&pageSize=50', { token });
  assert.equal(audit.status, 200);
  const events = audit.body.items.filter((event) => [email, unknown].includes(event.actorEmail));
  const counts = Object.fromEntries([...new Set(events.map((event) => event.action))].map((action) => [action, events.filter((event) => event.action === action).length]));
  assert.equal(counts.LOGIN, 1);
  assert.equal(counts.LOGIN_MISSING_CREDENTIALS, 1);
  assert.equal(counts.LOGIN_INVALID_PASSWORD, config.loginMaxAttempts);
  assert.equal(counts.ACCOUNT_LOCKED, 1);
  assert.equal(events.find((event) => event.action === 'ACCOUNT_LOCKED').result, 'SUCCESS');
  assert.equal(counts.LOGIN_BLOCKED, 1);
  assert.equal(counts.LOGIN_UNKNOWN_ACCOUNT, 1);
  assert(events.every((event) => event.createdAt.endsWith('Z') && Number.isFinite(Date.parse(event.createdAt))));
  const locks = await call('security-events?category=locks&pageSize=50', { token });
  assert.equal(locks.status, 200);
  assert(locks.body.items.every((event) => event.action === 'ACCOUNT_LOCKED'));
  assert(locks.body.items.some((event) => event.actorId === account.id));
  console.log(JSON.stringify({ ok: true, source: 'HTTP + PostgreSQL local', events: counts, samePublicError: true, blockedWithCorrectPassword: true, utc: true }));
} finally {
  // Exact UUID email/ID ownership checks: never delete any existing account.
  await prisma.$transaction(async (tx) => {
    await tx.securityEvent.deleteMany({ where: { actorEmail: { in: [email, unknown] } } });
    await tx.loginAttempt.deleteMany({ where: { email: { in: [email, unknown] } } });
    await tx.loginThrottle.deleteMany({ where: { email: { in: [email, unknown] } } });
    if (account) await tx.user.deleteMany({ where: { id: account.id, email, name: 'Prueba temporal auditoría HU20' } });
  });
  await prisma.$disconnect();
}
