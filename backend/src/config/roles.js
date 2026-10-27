// Roles de usuario (EP 1.1 · EP 1.2).
//
// El modelo es de *denegación por defecto*: el admin accede a todo y cualquier
// otro rol solo toca lo que su plantilla (o el Encargado, HU19) le concede. Un
// rol desconocido no accede a nada.

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

// Qué puede hacer cada rol en cada módulo se declara en config/permissions.js
// (HU19): ahí están las plantillas por rol y el mapeo de rutas a módulos.

/** Roles que solo ven y modifican los documentos que ellos mismos cargaron. */
export function isOwnerScoped(role) {
  return role !== ROLES.ADMIN;
}

// El User puede leer todo el repositorio (listado, detalle, archivo) aunque
// solo pueda editar/clasificar/validar lo que él mismo cargó — ownerFilter e
// isOwnerScoped siguen rigiendo esas acciones de escritura. El Ingestor no
// tiene rutas de lectura, pero de tenerlas seguiría acotado a lo propio.
/** Roles que solo VEN los documentos que ellos mismos cargaron. */
export function isViewScoped(role) {
  return role !== ROLES.ADMIN && role !== ROLES.USER;
}
