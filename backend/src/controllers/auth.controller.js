import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { config } from '../config/env.js';
import { signToken } from '../middleware/auth.js';

// HU25 — Un único mensaje para credenciales inválidas y cuenta bloqueada, para
// no revelar si el correo está registrado ni si hay un bloqueo vigente.
export const LOGIN_FAILED_MESSAGE =
  'No fue posible iniciar sesión. Verifica tus credenciales o intenta nuevamente en unos minutos.';

// Hash de una cadena aleatoria descartada: los correos inexistentes también
// pasan por bcrypt.compare para que el tiempo de respuesta sea el mismo.
const DUMMY_HASH = '$2a$10$yWM03700Bfkq.DIC3RwyVeiIES6sZIsU1iS7furdYDco1Gx5cM0hS';

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

// Registra el intento sin la contraseña. Un fallo al auditar no debe impedir
// responder el login.
async function recordAttempt(email, ip, { success, locked = false }) {
  try {
    await prisma.loginAttempt.create({ data: { email, ip: ip || null, success, locked } });
  } catch (err) {
    console.error('[auth] No se pudo registrar el intento de ingreso:', err.message);
  }
}

async function registerFailure(email, throttle, now) {
  // Un bloqueo vencido se trata como sin bloqueo: el contador parte de cero.
  const expired = throttle?.lockedUntil && throttle.lockedUntil <= now;
  const updated = expired
    ? await prisma.loginThrottle.update({
        where: { email },
        data: { failedCount: 1, lockedUntil: null },
      })
    : await prisma.loginThrottle.upsert({
        where: { email },
        create: { email, failedCount: 1 },
        update: { failedCount: { increment: 1 } },
      });

  if (updated.failedCount < config.loginMaxAttempts) return false;
  await prisma.loginThrottle.update({
    where: { email },
    data: { lockedUntil: new Date(now.getTime() + config.loginLockMinutes * 60 * 1000) },
  });
  return true;
}

export async function login(req, res) {
  const { email: rawEmail, password } = req.body || {};
  if (!rawEmail || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
  }
  const email = normalizeEmail(rawEmail);
  const now = new Date();

  // Con bloqueo vigente se rechaza sin comprobar la contraseña ni extender el bloqueo.
  const throttle = await prisma.loginThrottle.findUnique({ where: { email } });
  if (throttle?.lockedUntil && throttle.lockedUntil > now) {
    await recordAttempt(email, req.ip, { success: false, locked: true });
    return res.status(401).json({ error: LOGIN_FAILED_MESSAGE });
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid) {
    const locked = await registerFailure(email, throttle, now);
    await recordAttempt(email, req.ip, { success: false, locked });
    return res.status(401).json({ error: LOGIN_FAILED_MESSAGE });
  }

  if (throttle) {
    await prisma.loginThrottle.update({
      where: { email },
      data: { failedCount: 0, lockedUntil: null },
    });
  }
  await recordAttempt(email, req.ip, { success: true });

  const token = signToken(user);
  return res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}

export async function me(req, res) {
  return res.json({ user: req.user });
}
