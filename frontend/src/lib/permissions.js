// Permisos por módulo en el cliente (HU19).
//
// Espejo de backend/src/config/permissions.js. Los niveles efectivos de cada
// usuario llegan en user.permissions desde /auth/me; acá solo deciden qué se
// muestra o se habilita. El backend vuelve a validar cada petición.
import { ROLES } from './roles.js';

export const MODULES = {
  TABLERO: 'tablero',
  REPOSITORIO: 'repositorio',
  SOLICITUDES: 'solicitudes',
  BUSQUEDA: 'busqueda',
  CARGA: 'carga',
  INFORME: 'informe',
  NUBE: 'nube',
};

export const MODULE_LABELS = {
  [MODULES.TABLERO]: 'Tablero e Hitos',
  [MODULES.REPOSITORIO]: 'Repositorio',
  [MODULES.SOLICITUDES]: 'Solicitudes de Documentos',
  [MODULES.BUSQUEDA]: 'Búsqueda temática',
  [MODULES.CARGA]: 'Cargar Evidencia',
  [MODULES.INFORME]: 'Informe',
  [MODULES.NUBE]: 'Nube',
};

export const LEVELS = {
  DENEGADO: 'denegado',
  LECTURA: 'lectura',
  ESCRITURA: 'escritura',
};

export const LEVEL_LABELS = {
  [LEVELS.LECTURA]: 'Lectura',
  [LEVELS.ESCRITURA]: 'Escritura',
  [LEVELS.DENEGADO]: 'Denegado',
};

const RANK = { [LEVELS.DENEGADO]: 0, [LEVELS.LECTURA]: 1, [LEVELS.ESCRITURA]: 2 };

/**
 * ¿El usuario tiene al menos `level` en `module`? `module` puede ser una lista:
 * basta con cualquiera de ellos. El admin siempre puede.
 */
export function can(user, module, level = LEVELS.LECTURA) {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  return [].concat(module).some((m) => (RANK[user.permissions?.[m]] ?? 0) >= RANK[level]);
}

// Secciones de la aplicación con el módulo que las gobierna. El orden es el de
// la barra lateral. Una sección sin módulo es solo del admin. Cargar evidencia
// solo tiene sentido con escritura, así que con lectura no aparece.
export const SECTIONS = [
  { to: '/app', label: 'Tablero', end: true, module: MODULES.TABLERO },
  { to: '/documents', label: 'Repositorio', module: MODULES.REPOSITORIO },
  { to: '/requests', label: 'Solicitudes de documentos', module: MODULES.SOLICITUDES },
  { to: '/search', label: 'Búsqueda temática', module: MODULES.BUSQUEDA },
  { to: '/upload', label: 'Cargar evidencia', module: MODULES.CARGA, level: LEVELS.ESCRITURA },
  { to: '/structure', label: 'Estructura informe', module: MODULES.INFORME },
  { to: '/report', label: 'Redacción informe', module: MODULES.INFORME },
  { to: '/cloud', label: 'Google Drive', module: MODULES.NUBE },
  { to: '/trash', label: 'Papelera', module: MODULES.REPOSITORIO },
  { to: '/team', label: 'Equipo', module: null },
];

/** Secciones visibles: se ocultan los módulos denegados. */
export function navFor(user) {
  return SECTIONS.filter((s) => (s.module ? can(user, s.module, s.level) : user?.role === ROLES.ADMIN));
}

/** Primera pantalla del usuario tras iniciar sesión. */
export function homeFor(user) {
  return navFor(user)[0]?.to || '/acceso-denegado';
}
