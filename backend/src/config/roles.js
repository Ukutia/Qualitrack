// Roles de usuario (EP 1.1 · EP 1.2).
//
// El modelo es de *denegación por defecto*: el admin accede a todo y cualquier
// otro rol solo puede tocar las rutas que aparecen explícitamente en su lista.
// Un rol desconocido no accede a nada, así que incorporar un rol nuevo obliga a
// declarar sus permisos aquí y no repartidos por los controladores.

export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  INGESTOR: 'ingestor',
};

export const DEFAULT_ROLE = ROLES.ADMIN;

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrador de calidad',
  [ROLES.USER]: 'Miembro del equipo de aseguramiento de calidad',
  [ROLES.INGESTOR]: 'Ingestor de datos',
};

export function isKnownRole(role) {
  return Object.values(ROLES).includes(role);
}

const rule = (method, pattern) => ({ method, pattern });

// EP 1.1 — El Ingestor solo hace ingesta directa: sube archivos y consulta su
// propia sesión. Nada más.
const INGESTOR_RULES = [
  rule('GET', /^\/auth\/me$/),
  rule('POST', /^\/documents$/),
];

// EP 1.2 — El User hereda las capacidades del Ingestor y suma la nube, la
// revisión de propuestas de IA y el detalle de *sus* documentos. La pertenencia
// del documento no se resuelve acá (ver middleware/ownership.js): esta tabla
// solo decide qué rutas existen para el rol.
const USER_RULES = [
  ...INGESTOR_RULES,
  rule('GET', /^\/documents$/),
  rule('GET', /^\/documents\/\d+$/),
  rule('GET', /^\/documents\/\d+\/file$/),
  rule('PATCH', /^\/documents\/\d+\/date$/),
  rule('POST', /^\/documents\/\d+\/classify$/),
  rule('PUT', /^\/documents\/\d+\/association$/),
  rule('POST', /^\/associations\/\d+\/validate$/),
  rule('POST', /^\/associations\/\d+\/reject$/),
  // Necesita el árbol de subcriterios para reasignar manualmente.
  rule('GET', /^\/criteria$/),
  // Nube conectada (importación de documentos).
  rule('GET', /^\/cloud\/(google|dropbox)\/(status|auth-url|files)$/),
  rule('POST', /^\/cloud\/(google|dropbox)\/import$/),
  rule('DELETE', /^\/cloud\/(google|dropbox)\/disconnect$/),
  // Papelera
  rule('GET', /^\/documents\/trash$/),
  rule('POST', /^\/documents\/\d+\/trash$/),
  rule('POST', /^\/documents\/\d+\/restore$/),
  rule('DELETE', /^\/documents\/\d+$/),
];

const ROLE_RULES = {
  [ROLES.INGESTOR]: INGESTOR_RULES,
  [ROLES.USER]: USER_RULES,
};

/** ¿El rol puede ejecutar `method path`? El admin siempre puede. */
export function canAccess(role, method, path) {
  if (role === ROLES.ADMIN) return true;
  const rules = ROLE_RULES[role];
  if (!rules) return false;
  return rules.some((r) => r.method === method && r.pattern.test(path));
}

/** Roles que solo ven y modifican los documentos que ellos mismos cargaron. */
export function isOwnerScoped(role) {
  return role !== ROLES.ADMIN;
}
