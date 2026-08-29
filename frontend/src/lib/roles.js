// Roles de usuario en el cliente (EP 1.1 · EP 1.2).
//
// Espejo de backend/src/config/roles.js: acá solo decide qué se *muestra*.
// El backend vuelve a validar cada petición, así que ocultar una sección nunca
// es la única barrera.

export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  INGESTOR: 'ingestor',
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrador de calidad',
  [ROLES.USER]: 'Equipo de aseguramiento de calidad',
  [ROLES.INGESTOR]: 'Ingestor de datos',
};

const ALL = [ROLES.ADMIN, ROLES.USER, ROLES.INGESTOR];

// Secciones de la aplicación con los roles que pueden verlas. El orden es el de
// la barra lateral.
export const SECTIONS = [
  { to: '/app', label: 'Tablero', end: true, roles: [ROLES.ADMIN] },
  { to: '/documents', label: 'Repositorio', roles: [ROLES.ADMIN, ROLES.USER] },
  { to: '/upload', label: 'Cargar evidencia', roles: ALL },
  { to: '/structure', label: 'Estructura informe', roles: [ROLES.ADMIN] },
  { to: '/report', label: 'Redacción informe', roles: [ROLES.ADMIN] },
  { to: '/cloud', label: 'Google Drive', roles: [ROLES.ADMIN, ROLES.USER] },
  { to: '/trash', label: 'Papelera', roles: [ROLES.ADMIN] },
];

export function navFor(role) {
  return SECTIONS.filter((s) => s.roles.includes(role));
}

/** Primera pantalla del rol tras iniciar sesión. */
export function homeFor(role) {
  return navFor(role)[0]?.to || '/upload';
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || 'Sin rol asignado';
}

/** El rol solo trabaja con los documentos que él mismo cargó. */
export function isOwnerScoped(role) {
  return role !== ROLES.ADMIN;
}
