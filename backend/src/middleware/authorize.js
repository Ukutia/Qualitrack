// Control de acceso por rol (EP 1.1 · EP 1.2).
//
// Se resuelve en un único middleware montado justo después de requireAuth: la
// respuesta 403 sale antes de tocar la base de datos, así que la denegación es
// inmediata (criterio de aceptación: menos de 1 segundo).
import { canAccess } from '../config/roles.js';

export const ACCESS_DENIED = {
  code: 'FORBIDDEN_ROLE',
  error: 'Acceso denegado: su rol no tiene permisos para esta función.',
};

export function enforceRolePolicy(req, res, next) {
  if (canAccess(req.user?.role, req.method, req.path)) return next();
  return res.status(403).json(ACCESS_DENIED);
}

/** Restringe una ruta a roles concretos (uso puntual fuera de la tabla). */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.user?.role)) return next();
    return res.status(403).json(ACCESS_DENIED);
  };
}
