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

// Las secciones visibles dependen de los permisos por módulo: ver
// lib/permissions.js (HU19).

export function roleLabel(role) {
  return ROLE_LABELS[role] || 'Sin rol asignado';
}

/** El rol solo trabaja con los documentos que él mismo cargó. */
export function isOwnerScoped(role) {
  return role !== ROLES.ADMIN;
}
