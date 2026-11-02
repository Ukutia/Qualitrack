import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/middleware/authorize.js', async () => {
  const actual = await vi.importActual('../src/middleware/authorize.js');
  return {
    ...actual,
    loadPermissions: vi.fn(async (user) => user.permissions || {}),
  };
});

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    onboardingProgress: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const { prisma } = await import('../src/config/prisma.js');
const { MODULES, LEVELS } = await import('../src/config/permissions.js');
const {
  allOnboardingStepIds,
  authorizedOnboardingStepIds,
  isKnownOnboardingStep,
} = await import('../src/config/onboarding.js');
const {
  completeOnboardingStep,
  skipOnboarding,
  syncOnboarding,
} = await import('../src/services/onboarding.service.js');

const denied = () => Object.fromEntries(
  Object.values(MODULES).map((module) => [module, LEVELS.DENEGADO]),
);

const fullAdmin = {
  id: 1,
  role: 'admin',
  permissions: Object.fromEntries(
    Object.values(MODULES).map((module) => [module, LEVELS.ESCRITURA]),
  ),
};

function mockStoredProgress(initial) {
  let stored = initial;
  prisma.onboardingProgress.findUnique.mockImplementation(async () => stored);
  prisma.onboardingProgress.create.mockImplementation(async ({ data }) => {
    stored = { id: 1, ...data };
    return stored;
  });
  prisma.onboardingProgress.update.mockImplementation(async ({ data }) => {
    stored = { ...stored, ...data };
    return stored;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HU23 · catálogo y autorización', () => {
  it('conserva los 93 pasos de V2 y agrega cobertura sin IDs técnicos', () => {
    const originalV2 = {
      app: ['subcriterios', 'hitos-de-acreditacion', 'registrar-hito', 'modificar', 'marcar-completado'],
      milestones: ['registrar-hito', 'modificar', 'marcar-completado'],
      documents: ['todos', 'carpetas', 'lista', 'mosaico', 'filtros', 'limpiar-filtros', 'crear-carpeta', 'mover', 'renombrar', 'mover-a-papelera', 'papelera', 'cargar-evidencia'],
      'document-detail': ['validar', 'rechazar', 'reasignar', 'reclasificar', 'volver'],
      requests: ['crear-solicitud', 'copiar-link', 'pausar', 'reanudar', 'cancelar', 'eliminar'],
      'requests-new': ['crear-solicitud', 'volver'],
      search: ['lista', 'red-visual', 'agregar-tematica', 'buscar-tematica', 'eliminar-tematica'],
      upload: ['seleccionar-archivos', 'quitar', 'cargar-documentos', 'limpiar-lista', 'restaurar-existente', 'reemplazar', 'conservar-ambos', 'omitir-archivo'],
      structure: ['historial', 'importar-documento', 'editar-nueva-version', 'restaurar', 'confirmar-guardar', 'revisar-editar', 'agregar-seccion', 'guardar-nueva-version', 'reordenar-seccion', 'eliminar-seccion'],
      report: ['nuevo-borrador', 'seleccionar-borrador', 'eliminar-borrador', 'generacion-secciones-ia', 'anadir-seccion-ia', 'importar-reglas', 'guardar-configuracion', 'eliminar-configuracion', 'generar-vista-previa', 'detectar-incoherencias', 'insertar-texto', 'buscar-coincidencias', 'insertar-evidencia', 'historial', 'restaurar-version', 'exportar-pdf', 'exportar-docx'],
      cloud: ['conectar', 'atras', 'seleccionar', 'importar-seleccionados', 'importar', 'reintentar-pendientes', 'ir-a-evidencias', 'desconectar'],
      trash: ['volver-repositorio', 'restaurar', 'eliminar', 'restaurar-seleccionados', 'eliminar-seleccionados'],
      'security-events': ['actualizar-registro', 'todos-eventos', 'accesos-denegados', 'inicios-sesion', 'bloqueos-cuenta'],
      team: ['incorporar-equipo', 'eliminar-integrante'],
    };

    const originalIds = Object.entries(originalV2).flatMap(([section, controls]) =>
      controls.map((control) => `ui:${section}:${control}`),
    );

    expect(originalIds).toHaveLength(93);
    expect(originalIds.every(isKnownOnboardingStep)).toBe(true);
    expect(allOnboardingStepIds().length).toBeGreaterThan(93);
    expect(isKnownOnboardingStep('ui:report:b')).toBe(false);
    expect(isKnownOnboardingStep('ui:security-events:1')).toBe(false);
  });

  it('incluye una introducción para cada pestaña de la barra lateral', () => {
    const sidebarSections = [
      'app', 'documents', 'requests', 'search', 'upload', 'structure',
      'report', 'cloud', 'trash', 'security-events', 'team',
    ];

    expect(sidebarSections.every((section) =>
      isKnownOnboardingStep(`ui:${section}:intro`),
    )).toBe(true);
  });

  it('incluye las listas desplegables del recorrido sin repetirlas por fila', () => {
    const dropdownSteps = [
      'ui:app:responsable-hito',
      'ui:documents:ordenar',
      'ui:document-detail:seleccionar-subcriterio',
      'ui:search:seleccionar-tematica-red',
      'ui:report:estilo-parrafo',
      'ui:cloud:filtrar-tipo-archivo',
      'ui:security-events:filas-por-pagina',
      'ui:team:nivel-permiso',
      'ui:team:rol-integrante',
    ];

    expect(dropdownSteps.every(isKnownOnboardingStep)).toBe(true);
  });

  it('no entrega acciones de escritura a una cuenta con permiso de lectura', () => {
    const user = {
      id: 2,
      role: 'user',
      permissions: { ...denied(), [MODULES.REPOSITORIO]: LEVELS.LECTURA },
    };
    const authorized = authorizedOnboardingStepIds(user, user.permissions);

    expect(authorized).toContain('ui:documents:intro');
    expect(authorized).toContain('ui:documents:buscar');
    expect(authorized).toContain('ui:documents:ordenar');
    expect(authorized).toContain('ui:trash:intro');
    expect(authorized).not.toContain('ui:documents:crear-carpeta');
    expect(authorized).not.toContain('ui:documents:mover-a-papelera');
    expect(authorized).not.toContain('ui:trash:eliminar');
  });

  it('no crea pasos huérfanos de una pestaña inaccesible', () => {
    const ingestor = {
      id: 3,
      role: 'ingestor',
      permissions: { ...denied(), [MODULES.CARGA]: LEVELS.ESCRITURA },
    };
    const authorized = authorizedOnboardingStepIds(ingestor, ingestor.permissions);

    expect(authorized).toContain('ui:upload:intro');
    expect(authorized).toContain('ui:upload:cargar-documentos');
    expect(authorized).not.toContain('ui:documents:cargar-evidencia');
    expect(authorized).not.toContain('ui:cloud:cargar-desde-equipo');
  });
});

describe('HU23 · criterios de aceptación', () => {
  it('CDA1 crea el onboarding pendiente con todo el catálogo autorizado al iniciar sesión', async () => {
    const user = {
      id: 7,
      role: 'user',
      permissions: { ...denied(), [MODULES.TABLERO]: LEVELS.LECTURA },
    };
    mockStoredProgress(null);

    const result = await syncOnboarding(user, user.permissions);

    expect(result.status).toBe('PENDING');
    expect(result.completedStepIds).toEqual([]);
    expect(result.authorizedStepIds).toContain('ui:app:intro');
    expect(result.authorizedStepIds).toContain('ui:app:subcriterios');
    expect(result.authorizedStepIds).not.toContain('ui:app:registrar-hito');
    expect(prisma.onboardingProgress.create).toHaveBeenCalledOnce();
  });

  it('CDA2 registra SKIPPED y conserva el acceso a las tareas autorizadas', async () => {
    const user = {
      id: 8,
      role: 'user',
      permissions: { ...denied(), [MODULES.BUSQUEDA]: LEVELS.LECTURA },
    };
    mockStoredProgress({
      id: 2,
      userId: 8,
      status: 'PENDING',
      authorizedStepIds: [],
      completedStepIds: [],
    });

    const result = await skipOnboarding(user);

    expect(result.status).toBe('SKIPPED');
    expect(result.authorizedStepIds).toContain('ui:search:intro');
    expect(result.authorizedStepIds).toContain('ui:search:lista');
  });

  it('CDA3 conserva completados autorizados, quita revocados y agrega nuevos pendientes', async () => {
    const user = {
      id: 9,
      role: 'user',
      permissions: {
        ...denied(),
        [MODULES.REPOSITORIO]: LEVELS.LECTURA,
        [MODULES.BUSQUEDA]: LEVELS.LECTURA,
      },
    };
    mockStoredProgress({
      id: 3,
      userId: 9,
      status: 'IN_PROGRESS',
      authorizedStepIds: [
        'ui:app:subcriterios',
        'ui:documents:lista',
      ],
      completedStepIds: [
        'ui:app:subcriterios',
        'ui:documents:lista',
      ],
    });

    const result = await syncOnboarding(user, user.permissions);

    expect(result.completedStepIds).toEqual(['ui:documents:lista']);
    expect(result.authorizedStepIds).not.toContain('ui:app:subcriterios');
    expect(result.authorizedStepIds).toContain('ui:documents:lista');
    expect(result.authorizedStepIds).toContain('ui:search:intro');
    expect(result.completedStepIds).not.toContain('ui:search:intro');
    expect(result.status).toBe('IN_PROGRESS');
  });

  it('un paso completado queda persistido y deja de estar pendiente', async () => {
    mockStoredProgress({
      id: 4,
      userId: 1,
      status: 'PENDING',
      authorizedStepIds: [],
      completedStepIds: [],
    });

    const result = await completeOnboardingStep(fullAdmin, 'ui:report:nuevo-borrador');

    expect(result.completedStepIds).toContain('ui:report:nuevo-borrador');
    expect(result.status).toBe('IN_PROGRESS');
  });
});
