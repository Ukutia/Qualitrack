import { prisma } from '../config/prisma.js';
import { loadPermissions } from '../middleware/authorize.js';
import {
  authorizedOnboardingStepIds,
  isKnownOnboardingStep,
} from '../config/onboarding.js';

/**
 * Sincroniza el onboarding con los permisos efectivos actuales.
 *
 * CDA3:
 * - conserva completados que siguen autorizados;
 * - elimina completados que dejaron de estar autorizados;
 * - incorpora nuevas tareas autorizadas como pendientes.
 */
export async function syncOnboarding(user, suppliedPermissions = null) {
  const permissions =
    suppliedPermissions ?? (await loadPermissions(user));

  const authorizedStepIds =
    authorizedOnboardingStepIds(permissions);

  const current =
    await prisma.onboardingProgress.findUnique({
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

  const completedStepIds =
    current.completedStepIds.filter((stepId) =>
      authorizedStepIds.includes(stepId),
    );

  let status = current.status;

  // Omitir el onboarding es una decisión persistente.
  if (status !== 'SKIPPED') {
    if (
      authorizedStepIds.length > 0 &&
      completedStepIds.length === authorizedStepIds.length
    ) {
      status = 'COMPLETED';
    } else if (completedStepIds.length > 0) {
      status = 'IN_PROGRESS';
    } else {
      status = 'PENDING';
    }
  }

  return prisma.onboardingProgress.update({
    where: { userId: Number(user.id) },
    data: {
      status,
      completedStepIds,
      authorizedStepIds,
    },
  });
}

/**
 * Marca un paso como recorrido.
 */
export async function completeOnboardingStep(user, stepId) {
  if (!isKnownOnboardingStep(stepId)) {
    const error = new Error('Paso de onboarding no válido.');
    error.status = 400;
    throw error;
  }

  const current = await syncOnboarding(user);

  if (!current.authorizedStepIds.includes(stepId)) {
    const error = new Error(
      'No tienes autorización para este paso del onboarding.',
    );
    error.status = 403;
    throw error;
  }

  const completedStepIds = [
    ...new Set([...current.completedStepIds, stepId]),
  ];

  const completed =
    current.authorizedStepIds.length > 0 &&
    current.authorizedStepIds.every((id) =>
      completedStepIds.includes(id),
    );

  return prisma.onboardingProgress.update({
    where: { userId: Number(user.id) },
    data: {
      completedStepIds,
      status:
        current.status === 'SKIPPED'
          ? 'SKIPPED'
          : completed
            ? 'COMPLETED'
            : 'IN_PROGRESS',
    },
  });
}

/**
 * CDA2 — El integrante decide omitir la guía.
 */
export async function skipOnboarding(user) {
  const current = await syncOnboarding(user);

  return prisma.onboardingProgress.update({
    where: { userId: Number(user.id) },
    data: {
      status: 'SKIPPED',
      completedStepIds: current.completedStepIds,
      authorizedStepIds: current.authorizedStepIds,
    },
  });
}