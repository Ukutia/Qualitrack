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

// Catálogo estable de tareas. Conserva los 93 pasos de onboarding V2 y suma
// las funciones visibles que faltaban. Los controles repetidos por fila se
// representan una sola vez por función.
export const SECTION_STEP_KEYS = {
  app: new Set([
    'intro', 'subcriterios', 'hitos-de-acreditacion', 'filtro-en-plazo',
    'filtro-por-vencer', 'filtro-vencidos', 'filtro-completados', 'ver-todos',
    'registrar-hito', 'responsable-hito', 'guardar-hito', 'cancelar-edicion', 'modificar',
    'marcar-completado', 'cerrar-hitos', 'reintentar',
  ]),
  milestones: new Set([
    'intro', 'filtro-en-plazo', 'filtro-por-vencer', 'filtro-vencidos',
    'filtro-completados', 'registrar-hito', 'responsable-hito', 'guardar-hito', 'cancelar-edicion',
    'modificar', 'marcar-completado', 'cerrar-hitos', 'reintentar',
  ]),
  documents: new Set([
    'intro', 'todos', 'carpetas', 'ordenar', 'lista', 'mosaico', 'filtros',
    'limpiar-filtros', 'buscar', 'abrir-carpeta', 'acciones-elemento',
    'crear-carpeta', 'cancelar-crear-carpeta', 'mover', 'renombrar',
    'guardar-renombre', 'cancelar-renombre', 'mover-a-papelera',
    'eliminar-elemento', 'eliminar-solo-carpeta',
    'eliminar-carpeta-con-archivos', 'cancelar-eliminar-carpeta',
    'deseleccionar', 'cerrar-mensaje', 'reintentar', 'papelera',
    'cargar-evidencia',
  ]),
  'document-detail': new Set([
    'intro', 'ver-archivo', 'validar', 'rechazar', 'reasignar', 'reclasificar',
    'seleccionar-subcriterio', 'clasificacion-respaldo', 'mover-a-papelera', 'volver',
  ]),
  requests: new Set([
    'intro', 'crear-solicitud', 'tarjeta-solicitud', 'ver-recorrido',
    'documento-asociado', 'recorrido', 'enlace-recordatorios', 'mostrar-token',
    'copiar-link', 'historial-envios', 'pausar', 'reanudar', 'cancelar', 'eliminar',
  ]),
  'requests-new': new Set(['intro', 'crear-solicitud', 'volver']),
  search: new Set([
    'intro', 'lista', 'red-visual', 'agregar-tematica', 'buscar-tematica',
    'eliminar-tematica', 'cerrar-tematica', 'cancelar-tematica',
    'guardar-tematica', 'actualizar-red', 'reintentar-red', 'ver-todos',
    'abrir-documento', 'seleccionar-tematica-red', 'alejar', 'acercar',
    'ajustar-red', 'animacion',
  ]),
  upload: new Set([
    'intro', 'seleccionar-archivos', 'quitar', 'cargar-documentos',
    'limpiar-lista', 'restaurar-existente', 'reemplazar', 'conservar-ambos',
    'omitir-archivo',
  ]),
  structure: new Set([
    'intro', 'historial', 'cerrar-historial', 'importar-documento',
    'descartar-importacion', 'editar-nueva-version', 'cancelar-edicion',
    'restaurar', 'cancelar-restauracion', 'confirmar-guardar',
    'revisar-editar', 'agregar-seccion', 'guardar-nueva-version',
    'reordenar-seccion', 'eliminar-seccion',
  ]),
  report: new Set([
    'intro', 'nuevo-borrador', 'seleccionar-borrador', 'eliminar-borrador',
    'seleccionar-seccion', 'generacion-secciones-ia', 'seleccionar-regla-ia',
    'anadir-seccion-ia', 'importar-reglas', 'guardar-configuracion',
    'eliminar-configuracion', 'generar-vista-previa', 'detectar-incoherencias',
    'insertar-texto', 'buscar-coincidencias', 'insertar-evidencia', 'historial',
    'restaurar-version', 'exportar-pdf', 'exportar-docx', 'negrita', 'cursiva',
    'subrayado', 'estilo-parrafo', 'lista-vinetas', 'lista-numerada', 'cita', 'deshacer',
    'rehacer', 'guardar-ahora', 'cerrar-coincidencias', 'descartar-insercion',
    'confirmar-insercion', 'revisar-fuentes', 'descartar-vista-previa',
    'insertar-vista-previa',
  ]),
  cloud: new Set([
    'intro', 'google-drive', 'dropbox', 'conectar', 'cargar-desde-equipo',
    'atras', 'abrir-carpeta', 'filtrar-tipo-archivo', 'seleccionar',
    'importar-seleccionados', 'importar',
    'restaurar-existente', 'reemplazar', 'conservar-ambos',
    'cancelar-duplicado', 'reintentar-pendientes', 'ir-a-evidencias',
    'desconectar',
  ]),
  trash: new Set([
    'intro', 'volver-repositorio', 'restaurar', 'eliminar',
    'restaurar-seleccionados', 'eliminar-seleccionados',
    'confirmar-eliminacion', 'cancelar-eliminacion', 'reintentar',
  ]),
  'security-events': new Set([
    'intro', 'actualizar-registro', 'todos-eventos', 'accesos-denegados',
    'inicios-sesion', 'bloqueos-cuenta', 'pagina-anterior', 'ir-pagina',
    'pagina-siguiente', 'filas-por-pagina', 'reintentar',
  ]),
  team: new Set([
    'intro', 'buscar-integrantes', 'filas-equipo', 'pagina-anterior-equipo',
    'ir-pagina-equipo', 'pagina-siguiente-equipo', 'incorporar-equipo',
    'formulario-integrante', 'correo-integrante', 'nombre-integrante',
    'cargo-integrante', 'rol-integrante', 'confirmar-incorporacion',
    'cancelar-incorporacion', 'eliminar-integrante', 'editar-permisos', 'buscar-permisos',
    'filas-permisos', 'nivel-permiso', 'pagina-anterior-permisos',
    'ir-pagina-permisos', 'pagina-siguiente-permisos', 'volver-equipo',
  ]),
};

const WRITE_CONTROLS = {
  app: new Set([
    'registrar-hito', 'guardar-hito', 'cancelar-edicion', 'modificar',
    'marcar-completado', 'responsable-hito',
  ]),
  milestones: new Set([
    'registrar-hito', 'guardar-hito', 'cancelar-edicion', 'modificar',
    'marcar-completado', 'responsable-hito',
  ]),
  documents: new Set([
    'acciones-elemento', 'crear-carpeta', 'cancelar-crear-carpeta', 'mover',
    'renombrar', 'guardar-renombre', 'cancelar-renombre', 'mover-a-papelera',
    'eliminar-elemento', 'eliminar-solo-carpeta',
    'eliminar-carpeta-con-archivos', 'cancelar-eliminar-carpeta',
    'deseleccionar', 'cerrar-mensaje',
  ]),
  'document-detail': new Set([
    'validar', 'rechazar', 'reasignar', 'reclasificar',
    'seleccionar-subcriterio', 'clasificacion-respaldo', 'mover-a-papelera',
  ]),
  requests: new Set([
    'crear-solicitud', 'pausar', 'reanudar', 'cancelar', 'eliminar',
  ]),
  search: new Set([
    'agregar-tematica', 'eliminar-tematica', 'cerrar-tematica',
    'cancelar-tematica', 'guardar-tematica',
  ]),
  structure: new Set([
    'importar-documento', 'descartar-importacion', 'editar-nueva-version',
    'cancelar-edicion', 'restaurar', 'cancelar-restauracion',
    'confirmar-guardar', 'revisar-editar', 'agregar-seccion',
    'guardar-nueva-version', 'reordenar-seccion', 'eliminar-seccion',
  ]),
  report: new Set([
    'nuevo-borrador', 'eliminar-borrador', 'generacion-secciones-ia',
    'seleccionar-regla-ia', 'anadir-seccion-ia', 'importar-reglas',
    'guardar-configuracion', 'eliminar-configuracion', 'generar-vista-previa',
    'detectar-incoherencias', 'insertar-texto', 'buscar-coincidencias',
    'insertar-evidencia', 'restaurar-version', 'negrita', 'cursiva',
    'subrayado', 'estilo-parrafo', 'lista-vinetas', 'lista-numerada', 'cita', 'deshacer',
    'rehacer', 'guardar-ahora', 'cerrar-coincidencias', 'descartar-insercion',
    'confirmar-insercion', 'revisar-fuentes', 'descartar-vista-previa',
    'insertar-vista-previa',
  ]),
  cloud: new Set([
    'conectar', 'seleccionar', 'importar-seleccionados', 'importar',
    'restaurar-existente', 'reemplazar', 'conservar-ambos',
    'cancelar-duplicado', 'reintentar-pendientes', 'ir-a-evidencias',
    'desconectar',
  ]),
  trash: new Set([
    'restaurar', 'eliminar', 'restaurar-seleccionados',
    'eliminar-seleccionados', 'confirmar-eliminacion',
    'cancelar-eliminacion',
  ]),
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
  return Boolean(
    SECTION_RULES[parsed.section] &&
    SECTION_STEP_KEYS[parsed.section]?.has(parsed.control),
  );
}

export function allOnboardingStepIds() {
  return Object.entries(SECTION_STEP_KEYS)
    .flatMap(([section, controls]) =>
      [...controls].map((control) => `ui:${section}:${control}`),
    )
    .sort();
}

function ruleForStep(section, control) {
  if (section === 'documents' && control === 'cargar-evidencia') {
    return {
      allOf: [
        { module: MODULES.REPOSITORIO, level: LEVELS.LECTURA },
        { module: MODULES.CARGA, level: LEVELS.ESCRITURA },
      ],
    };
  }

  if (section === 'cloud' && control === 'cargar-desde-equipo') {
    return {
      allOf: [
        { module: MODULES.NUBE, level: LEVELS.LECTURA },
        { module: MODULES.CARGA, level: LEVELS.ESCRITURA },
      ],
    };
  }

  const sectionRule = SECTION_RULES[section];
  if (sectionRule?.adminOnly) return sectionRule;

  if (WRITE_CONTROLS[section]?.has(control)) {
    return { ...sectionRule, level: LEVELS.ESCRITURA };
  }

  return sectionRule;
}

export function isOnboardingStepAuthorized(user, permissions, stepId) {
  const parsed = parseOnboardingStepId(stepId);
  if (!parsed || !isKnownOnboardingStep(stepId)) return false;

  if (user?.role === 'admin') return true;

  const rule = ruleForStep(parsed.section, parsed.control);
  if (!rule || rule.adminOnly) return false;

  if (rule.allOf) {
    return rule.allOf.every(({ module, level }) =>
      levelSatisfies(
        permissions?.[module] ?? LEVELS.DENEGADO,
        level,
      ),
    );
  }

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

export function authorizedOnboardingStepIds(user, permissions) {
  return filterAuthorizedOnboardingStepIds(
    user,
    permissions,
    allOnboardingStepIds(),
  );
}
