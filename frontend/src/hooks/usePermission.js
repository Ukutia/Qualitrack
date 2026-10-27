import { useAuth } from '../context/AuthContext.jsx';
import { LEVELS, can } from '../lib/permissions.js';

/** Nivel del usuario en un módulo (HU19): { canRead, canWrite }. */
export function usePermission(module) {
  const { user } = useAuth();
  return {
    canRead: can(user, module, LEVELS.LECTURA),
    canWrite: can(user, module, LEVELS.ESCRITURA),
  };
}
