// Permisos por módulo (HU19).
//
// El Encargado (admin) decide qué puede hacer cada integrante en cada módulo:
// lectura, escritura o denegado. Cada ruta de la API pertenece a uno o más
// módulos y exige un nivel mínimo. Una ruta que no figura acá queda denegada
// para todo rol que no sea admin (denegación por defecto, igual que antes).
//
// Si un usuario no tiene fila guardada para un módulo rige la plantilla de su
// rol, que reproduce lo que cada rol podía hacer antes de la HU19.
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

// Orden de los niveles: escritura incluye lectura.
const RANK = { [LEVELS.DENEGADO]: 0, [LEVELS.LECTURA]: 1, [LEVELS.ESCRITURA]: 2 };

export function isKnownModule(module) {
  return Object.values(MODULES).includes(module);
}

export function isKnownLevel(level) {
  return Object.values(LEVELS).includes(level);
}

/** ¿El nivel concedido alcanza el mínimo exigido? */
export function levelSatisfies(granted, required) {
  return (RANK[granted] ?? 0) >= RANK[required];
}

const { TABLERO, REPOSITORIO, SOLICITUDES, BUSQUEDA, CARGA, INFORME, NUBE } = MODULES;
const ALL_DENIED = Object.fromEntries(Object.values(MODULES).map((m) => [m, LEVELS.DENEGADO]));

// Plantillas por rol: equivalen a las reglas que tenía config/roles.js.
export const ROLE_TEMPLATES = {
  [ROLES.USER]: {
    ...ALL_DENIED,
    // Hitos (HU24): el equipo los consulta y completa los que tiene a cargo.
    [TABLERO]: LEVELS.ESCRITURA,
    [REPOSITORIO]: LEVELS.ESCRITURA,
    [SOLICITUDES]: LEVELS.ESCRITURA,
    [CARGA]: LEVELS.ESCRITURA,
    [NUBE]: LEVELS.ESCRITURA,
  },
  [ROLES.INGESTOR]: {
    ...ALL_DENIED,
    [CARGA]: LEVELS.ESCRITURA,
  },
};

const FULL_ACCESS = Object.fromEntries(Object.values(MODULES).map((m) => [m, LEVELS.ESCRITURA]));

// GET exige lectura y el resto de los métodos escritura, salvo que la regla
// indique otro nivel (ver las dos excepciones más abajo).
const levelFor = (method) => (method === 'GET' ? LEVELS.LECTURA : LEVELS.ESCRITURA);

const route = (method, pattern, modules, level = levelFor(method)) => ({
  method,
  pattern,
  modules: [].concat(modules),
  level,
});

// Rutas que basta con tener sesión para usar.
// Registrar una navegación bloqueada (HU20) también: el controlador verifica
// que la sección esté realmente denegada.
const AUTHENTICATED = [
  route('GET', /^\/auth\/me$/, []),
  route('POST', /^\/auth\/access-denied$/, []),
];

// Las rutas de /team (incluidos los permisos) y /security-events no figuran:
// son solo del admin.
const ROUTES = [
  // Tablero e Hitos
  route('GET', /^\/compliance$/, TABLERO),
  route('GET', /^\/milestones(\/responsibles)?$/, TABLERO),
  route('POST', /^\/milestones(\/\d+\/complete)?$/, TABLERO),
  route('PUT', /^\/milestones\/\d+$/, TABLERO),
  // El árbol de subcriterios lo usan el tablero, la reasignación manual del
  // repositorio y el informe.
  route('GET', /^\/criteria$/, [TABLERO, REPOSITORIO, INFORME]),

  // Repositorio (incluye la papelera)
  route('GET', /^\/documents$/, [REPOSITORIO, INFORME]),
  route('GET', /^\/documents\/filter-options$/, REPOSITORIO),
  route('GET', /^\/documents\/trash$/, REPOSITORIO),
  route('GET', /^\/documents\/\d+$/, [REPOSITORIO, BUSQUEDA]),
  route('GET', /^\/documents\/\d+\/(file|content|sheets)$/, [REPOSITORIO, BUSQUEDA]),
  route('GET', /^\/documents\/\d+\/passages\/\d+(\/focus)?$/, [REPOSITORIO, BUSQUEDA]),
  // Aviso de fin de análisis tras cargar un archivo.
  route('GET', /^\/documents\/\d+\/stream$/, [REPOSITORIO, CARGA]),
  route('PATCH', /^\/documents\/\d+\/(analysis-status|date|name)$/, REPOSITORIO),
  route('POST', /^\/documents\/\d+\/(trash|restore)$/, REPOSITORIO),
  route('DELETE', /^\/documents\/\d+$/, REPOSITORIO),
  route('POST', /^\/documents\/\d+\/classify(\/fallback)?$/, REPOSITORIO),
  route('PUT', /^\/documents\/\d+\/association$/, REPOSITORIO),
  route('POST', /^\/associations\/\d+\/(validate|reject)$/, REPOSITORIO),
  // Organización virtual compartida del repositorio (HU26).
  route('GET', /^\/folders\/explore$/, REPOSITORIO),
  route('POST', /^\/folders$/, REPOSITORIO),
  route('POST', /^\/folders\/(move-documents|bulk-trash)$/, REPOSITORIO),
  route('PATCH', /^\/folders\/\d+$/, REPOSITORIO),
  route('POST', /^\/folders\/\d+\/move$/, REPOSITORIO),
  route('DELETE', /^\/folders\/\d+$/, REPOSITORIO),

  // Solicitudes de documentos
  route('GET', /^\/document-requests(\/config)?$/, SOLICITUDES),
  route('POST', /^\/document-requests$/, SOLICITUDES),
  route('POST', /^\/document-requests\/\d+\/(pause|resume|cancel)$/, SOLICITUDES),
  route('DELETE', /^\/document-requests\/\d+$/, SOLICITUDES),

  // Búsqueda temática. Excepción: la búsqueda semántica es un POST pero solo
  // consulta, así que basta lectura. El informe también la usa.
  route('POST', /^\/search\/semantic$/, [BUSQUEDA, INFORME], LEVELS.LECTURA),
  route('GET', /^\/topics(\/network)?$/, BUSQUEDA),
  route('POST', /^\/topics$/, BUSQUEDA),
  route('DELETE', /^\/topics\/\d+$/, BUSQUEDA),

  // Cargar evidencia
  route('POST', /^\/documents$/, CARGA),

  // Informe: estructura y redacción
  route('GET', /^\/report-structure(\/history)?$/, INFORME),
  route('POST', /^\/report-structure(\/parse)?$/, INFORME),
  route('POST', /^\/report-structure\/\d+\/restore$/, INFORME),
  route('GET', /^\/report-drafts$/, INFORME),
  route('GET', /^\/report-drafts\/\d+(\/(sections|generation-sections|history|export\/pdf|export\/docx))?$/, INFORME),
  route('POST', /^\/report-drafts$/, INFORME),
  route('PUT', /^\/report-drafts\/\d+$/, INFORME),
  route('DELETE', /^\/report-drafts\/\d+$/, INFORME),
  route('PUT', /^\/report-drafts\/\d+\/sections\/\d+$/, INFORME),
  route('POST', /^\/report-drafts\/\d+\/generation-sections(\/import)?$/, INFORME),
  route('PUT', /^\/report-drafts\/\d+\/generation-sections\/\d+(\/content)?$/, INFORME),
  route('DELETE', /^\/report-drafts\/\d+\/generation-sections\/\d+$/, INFORME),
  route('POST', /^\/report-drafts\/\d+\/(preview|incoherences)$/, INFORME),
  route('POST', /^\/report-drafts\/\d+\/versions\/\d+\/restore$/, INFORME),

  // Nube. Excepción: auth-url es un GET pero inicia una conexión nueva, así
  // que exige escritura.
  route('GET', /^\/cloud\/(google|dropbox)\/(status|files)$/, NUBE),
  route('GET', /^\/cloud\/(google|dropbox)\/auth-url$/, NUBE, LEVELS.ESCRITURA),
  route('POST', /^\/cloud\/(google|dropbox)\/import$/, NUBE),
  route('DELETE', /^\/cloud\/(google|dropbox)\/disconnect$/, NUBE),
];

/** Regla que gobierna `method path`, o null si la ruta no está mapeada. */
export function findRoute(method, path) {
  return [...AUTHENTICATED, ...ROUTES].find((r) => r.method === method && r.pattern.test(path)) || null;
}

/**
 * Permisos efectivos { módulo: nivel } a partir del rol y de las filas
 * guardadas. El admin tiene escritura en todo y sus filas se ignoran.
 */
export function effectivePermissions(role, rows = []) {
  if (role === ROLES.ADMIN) return { ...FULL_ACCESS };
  const permissions = { ...(ROLE_TEMPLATES[role] || ALL_DENIED) };
  for (const row of rows) {
    if (isKnownModule(row.module) && isKnownLevel(row.level)) permissions[row.module] = row.level;
  }
  return permissions;
}

/** ¿Unos permisos efectivos alcanzan para `method path`? */
export function allows(permissions, method, path) {
  const rule = findRoute(method, path);
  if (!rule) return false;
  if (!rule.modules.length) return true;
  return rule.modules.some((m) => levelSatisfies(permissions[m], rule.level));
}

/** ¿El rol, solo con su plantilla, puede ejecutar `method path`? */
export function canAccess(role, method, path) {
  if (role === ROLES.ADMIN) return true;
  return allows(effectivePermissions(role), method, path);
}
