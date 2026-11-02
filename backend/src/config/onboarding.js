import { MODULES, LEVELS, levelSatisfies } from './permissions.js';

const SECTION_RULES = {
  app: { modules: [MODULES.TABLERO], level: LEVELS.LECTURA },
  milestones: { modules: [MODULES.TABLERO], level: LEVELS.LECTURA },
  documents: { modules: [MODULES.REPOSITORIO], level: LEVELS.LECTURA },
  'document-detail': { modules: [MODULES.REPOSITORIO, MODULES.BUSQUEDA], level: LEVELS.LECTURA },
  requests: { modules: [MODULES.SOLICITUDES], level: LEVELS.LECTURA },
  'requests-new': { modules: [MODULES.SOLICITUDES], level: LEVELS.ESCRITURA },
  search: { modules: [MODULES.BUSQUEDA], level: LEVELS.LECTURA },
  upload: { modules: [MODULES.CARGA], level: LEVELS.ESCRITURA },
  structure: { modules: [MODULES.INFORME], level: LEVELS.LECTURA },
  report: { modules: [MODULES.INFORME], level: LEVELS.LECTURA },
  cloud: { modules: [MODULES.NUBE], level: LEVELS.LECTURA },
  trash: { modules: [MODULES.REPOSITORIO], level: LEVELS.LECTURA },
  'security-events': { adminOnly: true },
  team: { adminOnly: true },
};

// Allowlist estable de funciones relevantes de HU23.
// Esto evita conservar pasos técnicos antiguos (B, números de página, etc.)
// sin borrar pasos válidos solo porque temporalmente no estén visibles.
const SECTION_STEP_KEYS = {
  app: new Set(['subcriterios', 'hitos-de-acreditacion', 'registrar-hito', 'modificar', 'marcar-completado']),
  milestones: new Set(['registrar-hito', 'modificar', 'marcar-completado']),
  documents: new Set(['todos', 'carpetas', 'lista', 'mosaico', 'filtros', 'limpiar-filtros', 'crear-carpeta', 'mover', 'renombrar', 'mover-a-papelera', 'papelera', 'cargar-evidencia']),
  'document-detail': new Set(['validar', 'rechazar', 'reasignar', 'reclasificar', 'volver']),
  requests: new Set(['crear-solicitud', 'copiar-link', 'pausar', 'reanudar', 'cancelar', 'eliminar']),
  'requests-new': new Set(['crear-solicitud', 'volver']),
  search: new Set(['lista', 'red-visual', 'agregar-tematica', 'buscar-tematica', 'eliminar-tematica']),
  upload: new Set(['seleccionar-archivos', 'quitar', 'cargar-documentos', 'limpiar-lista', 'restaurar-existente', 'reemplazar', 'conservar-ambos', 'omitir-archivo']),
  structure: new Set(['historial', 'importar-documento', 'editar-nueva-version', 'restaurar', 'confirmar-guardar', 'revisar-editar', 'agregar-seccion', 'guardar-nueva-version', 'reordenar-seccion', 'eliminar-seccion']),
  report: new Set(['nuevo-borrador', 'seleccionar-borrador', 'eliminar-borrador', 'generacion-secciones-ia', 'anadir-seccion-ia', 'importar-reglas', 'guardar-configuracion', 'eliminar-configuracion', 'generar-vista-previa', 'detectar-incoherencias', 'insertar-texto', 'buscar-coincidencias', 'insertar-evidencia', 'historial', 'restaurar-version', 'exportar-pdf', 'exportar-docx']),
  cloud: new Set(['conectar', 'atras', 'seleccionar', 'importar-seleccionados', 'importar', 'reintentar-pendientes', 'ir-a-evidencias', 'desconectar']),
  trash: new Set(['volver-repositorio', 'restaurar', 'eliminar', 'restaurar-seleccionados', 'eliminar-seleccionados']),
  'security-events': new Set(['actualizar-registro', 'todos-eventos', 'accesos-denegados', 'inicios-sesion', 'bloqueos-cuenta']),
  team: new Set(['incorporar-equipo', 'eliminar-integrante']),
};

const STEP_RE = /^ui:([a-z0-9-]+):([a-z0-9-]+)$/;

export function parseOnboardingStepId(stepId) {
  const match = STEP_RE.exec(String(stepId || ''));
  if (!match) return null;
  return { section: match[1], control: match[2] };
}

export function isKnownOnboardingStep(stepId) {
  const parsed = parseOnboardingStepId(stepId);
  if (!parsed) return false;

  const allowed = SECTION_STEP_KEYS[parsed.section];
  return Boolean(
    SECTION_RULES[parsed.section] &&
    allowed?.has(parsed.control),
  );
}

export function isOnboardingStepAuthorized(user, permissions, stepId) {
  const parsed = parseOnboardingStepId(stepId);
  if (!parsed || !isKnownOnboardingStep(stepId)) return false;

  const rule = SECTION_RULES[parsed.section];
  if (!rule) return false;

  if (rule.adminOnly) return user?.role === 'admin';

  return rule.modules.some((module) =>
    levelSatisfies(
      permissions?.[module] ?? LEVELS.DENEGADO,
      rule.level,
    ),
  );
}

export function filterAuthorizedOnboardingStepIds(user, permissions, stepIds = []) {
  return [...new Set(stepIds)]
    .filter((stepId) => isOnboardingStepAuthorized(user, permissions, stepId))
    .sort();
}
