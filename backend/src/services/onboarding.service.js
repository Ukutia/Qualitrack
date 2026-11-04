import { prisma } from '../config/prisma.js';
import { loadPermissions } from '../middleware/authorize.js';
import {
  authorizedOnboardingStepIds,
  filterAuthorizedOnboardingStepIds,
  isKnownOnboardingStep,
  isOnboardingStepAuthorized,
  SECTION_STEP_KEYS,
} from '../config/onboarding.js';

function statusFor(status, authorizedStepIds, completedStepIds) {
  if (status === 'SKIPPED') return 'SKIPPED';
  if (authorizedStepIds.length === 0) return 'PENDING';
  if (completedStepIds.length === authorizedStepIds.length) return 'COMPLETED';
  if (completedStepIds.length > 0) return 'IN_PROGRESS';
  return 'PENDING';
}

export async function syncOnboarding(user, suppliedPermissions = null) {
  const permissions = suppliedPermissions ?? (await loadPermissions(user));
  const authorizedStepIds = authorizedOnboardingStepIds(user, permissions);

  const current = await prisma.onboardingProgress.findUnique({
    where: { userId: Number(user.id) },
  });

  if (!current) {
    return prisma.onboardingProgress.create({
      data: {
        userId: Number(user.id),
        status: 'PENDING',
        completedStepIds: [],
        authorizedStepIds,
      },
    });
  }

  // CDA3: el catálogo autorizado se recalcula al iniciar sesión. Así se
  // conservan los completados aún autorizados, se excluyen los revocados y
  // aparecen inmediatamente los nuevos permisos como tareas pendientes.
  const completedStepIds = filterAuthorizedOnboardingStepIds(
    user,
    permissions,
    current.completedStepIds,
  ).filter((stepId) => authorizedStepIds.includes(stepId));

  const status = statusFor(
    current.status,
    authorizedStepIds,
    completedStepIds,
  );

  return prisma.onboardingProgress.update({
    where: { userId: Number(user.id) },
    data: {
      status,
      completedStepIds,
      authorizedStepIds,
    },
  });
}

export async function syncAvailableOnboardingSteps(user) {
  // Compatibilidad con el cliente V2: la visibilidad del DOM ya no define
  // permisos ni progreso. El backend mantiene el catálogo completo por rol.
  return syncOnboarding(user);
}

export async function completeOnboardingStep(user, stepId) {
  if (!isKnownOnboardingStep(stepId)) {
    const error = new Error('Paso de onboarding no válido.');
    error.status = 400;
    throw error;
  }

  const permissions = await loadPermissions(user);

  if (!isOnboardingStepAuthorized(user, permissions, stepId)) {
    const error = new Error(
      'No tienes autorización para este paso del onboarding.',
    );
    error.status = 403;
    throw error;
  }

  const current = await syncOnboarding(user, permissions);
  const completedStepIds = [
    ...new Set([...current.completedStepIds, stepId]),
  ].sort();

  const status = statusFor(
    current.status,
    current.authorizedStepIds,
    completedStepIds,
  );

  return prisma.onboardingProgress.update({
    where: { userId: Number(user.id) },
    data: {
      completedStepIds,
      status,
    },
  });
}

export async function skipOnboardingSection(user, section) {
  if (!Object.hasOwn(SECTION_STEP_KEYS, section)) {
    const error = new Error('Guía de onboarding no válida.');
    error.status = 400;
    throw error;
  }

  const permissions = await loadPermissions(user);
  const current = await syncOnboarding(user, permissions);
  const prefix = `ui:${section}:`;
  const sectionStepIds = current.authorizedStepIds.filter((stepId) =>
    stepId.startsWith(prefix),
  );

  if (sectionStepIds.length === 0) {
    const error = new Error('No tienes autorización para esta guía de onboarding.');
    error.status = 403;
    throw error;
  }

  const completedStepIds = [
    ...new Set([...current.completedStepIds, ...sectionStepIds]),
  ].sort();

  return prisma.onboardingProgress.update({
    where: { userId: Number(user.id) },
    data: {
      status: statusFor(
        current.status,
        current.authorizedStepIds,
        completedStepIds,
      ),
      completedStepIds,
    },
  });
}
