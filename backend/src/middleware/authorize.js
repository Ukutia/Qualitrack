// Control de acceso por módulo (EP 1.1 · EP 1.2 · HU19).
//
// Se resuelve en un único middleware montado justo después de requireAuth. El
// admin pasa siempre y una ruta sin mapear se rechaza sin tocar la base de
// datos. Para el resto se cargan los permisos personalizados del usuario (con
// un caché corto que se invalida al guardarlos) y se combinan con la plantilla
// de su rol.
import { prisma } from '../config/prisma.js';
import { ROLES } from '../config/roles.js';
import { allows, effectivePermissions, findRoute } from '../config/permissions.js';

export const ACCESS_DENIED = {
  code: 'FORBIDDEN_ROLE',
  error: 'Acceso denegado: no tiene permisos para esta función.',
};

const CACHE_TTL_MS = 30_000;
const cache = new Map();

/** Olvida los permisos cacheados de un usuario (llamar al guardarlos). */
export function invalidatePermissions(userId) {
  cache.delete(Number(userId));
}

/** Permisos efectivos { módulo: nivel } del usuario autenticado. */
export async function loadPermissions(user) {
  if (user?.role === ROLES.ADMIN) return effectivePermissions(ROLES.ADMIN);
  const key = Number(user?.id);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.permissions;

  const rows = await prisma.userPermission.findMany({
    where: { userId: key },
    select: { module: true, level: true },
  });
  const permissions = effectivePermissions(user?.role, rows);
  cache.set(key, { permissions, expires: Date.now() + CACHE_TTL_MS });
  return permissions;
}

// HU20: el registro de seguridad responde con su propio texto.
const deny = (req, res) =>
  res.status(403).json(req.path === '/security-events' ? { ...ACCESS_DENIED, error: 'Acceso Denegado' } : ACCESS_DENIED);

export async function enforceRolePolicy(req, res, next) {
  if (req.user?.role === ROLES.ADMIN) return next();
  const rule = findRoute(req.method, req.path);
  if (!rule) return deny(req, res);
  if (!rule.modules.length) return next();

  try {
    const permissions = await loadPermissions(req.user);
    if (allows(permissions, req.method, req.path)) return next();
    return deny(req, res);
  } catch (error) {
    return next(error);
  }
}

/** Restringe una ruta a roles concretos (uso puntual fuera de la tabla). */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.user?.role)) return next();
    return res.status(403).json(ACCESS_DENIED);
  };
}
