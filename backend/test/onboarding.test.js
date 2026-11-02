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
  filterAuthorizedOnboardingStepIds,
} = await import('../src/config/onboarding.js');
const {
  syncOnboarding,
  syncAvailableOnboardingSteps,
} = await import('../src/services/onboarding.service.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HU23 · persistencia y reconciliación', () => {
  const fullAdmin = {
    id: 1,
    role: 'admin',
    permissions: Object.fromEntries(
      Object.values(MODULES).map((module) => [module, LEVELS.ESCRITURA]),
    ),
  };

  it('elimina IDs técnicos antiguos mediante la allowlist curada', () => {
    const result = filterAuthorizedOnboardingStepIds(
      fullAdmin,
      fullAdmin.permissions,
      [
        'ui:report:b',
        'ui:report:seccion-1',
        'ui:security-events:1',
        'ui:report:nuevo-borrador',
        'ui:security-events:actualizar-registro',
      ],
    );

    expect(result).toEqual([
      'ui:report:nuevo-borrador',
      'ui:security-events:actualizar-registro',
    ]);
  });

  it('no borra completados válidos si temporalmente no están visibles', async () => {
    prisma.onboardingProgress.findUnique.mockResolvedValue({
      id: 1,
      userId: 1,
      status: 'COMPLETED',
      authorizedStepIds: [
        'ui:documents:carpetas',
        'ui:documents:lista',
      ],
      completedStepIds: [
        'ui:documents:carpetas',
        'ui:documents:lista',
      ],
    });

    prisma.onboardingProgress.update.mockImplementation(async ({ data }) => ({
      id: 1,
      userId: 1,
      ...data,
    }));

    const result = await syncAvailableOnboardingSteps(fullAdmin, [
      '__section:documents',
      'ui:documents:carpetas',
    ]);

    expect(result.authorizedStepIds).toEqual([
      'ui:documents:carpetas',
      'ui:documents:lista',
    ]);

    expect(result.completedStepIds).toEqual([
      'ui:documents:carpetas',
      'ui:documents:lista',
    ]);

    expect(result.status).toBe('COMPLETED');
  });

  it('incorpora un botón nuevo como pendiente sin perder completados anteriores', async () => {
    prisma.onboardingProgress.findUnique.mockResolvedValue({
      id: 1,
      userId: 1,
      status: 'COMPLETED',
      authorizedStepIds: ['ui:documents:carpetas'],
      completedStepIds: ['ui:documents:carpetas'],
    });

    prisma.onboardingProgress.update.mockImplementation(async ({ data }) => ({
      id: 1,
      userId: 1,
      ...data,
    }));

    const result = await syncAvailableOnboardingSteps(fullAdmin, [
      '__section:documents',
      'ui:documents:carpetas',
      'ui:documents:mosaico',
    ]);

    expect(result.authorizedStepIds).toEqual([
      'ui:documents:carpetas',
      'ui:documents:mosaico',
    ]);
    expect(result.completedStepIds).toEqual([
      'ui:documents:carpetas',
    ]);
    expect(result.status).toBe('IN_PROGRESS');
  });

  it('CDA3 elimina pasos cuando se pierde el permiso del módulo', async () => {
    const user = {
      id: 7,
      role: 'user',
      permissions: {
        [MODULES.TABLERO]: LEVELS.LECTURA,
        [MODULES.REPOSITORIO]: LEVELS.DENEGADO,
      },
    };

    prisma.onboardingProgress.findUnique.mockResolvedValue({
      id: 1,
      userId: 7,
      status: 'IN_PROGRESS',
      authorizedStepIds: [
        'ui:app:subcriterios',
        'ui:documents:carpetas',
      ],
      completedStepIds: [
        'ui:app:subcriterios',
        'ui:documents:carpetas',
      ],
    });

    prisma.onboardingProgress.update.mockImplementation(async ({ data }) => ({
      id: 1,
      userId: 7,
      ...data,
    }));

    const result = await syncOnboarding(user, user.permissions);

    expect(result.authorizedStepIds).toEqual([
      'ui:app:subcriterios',
    ]);
    expect(result.completedStepIds).toEqual([
      'ui:app:subcriterios',
    ]);
    expect(result.status).toBe('COMPLETED');
  });
});
