import { prisma } from '../config/prisma.js';
import { loadPermissions } from '../middleware/authorize.js';
import {
  filterAuthorizedOnboardingStepIds,
  isKnownOnboardingStep,
  isOnboardingStepAuthorized,
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

  const current = await prisma.onboardingProgress.findUnique({
    where: { userId: Number(user.id) },
  });

  if (!current) {
    return prisma.onboardingProgress.create({
      data: {
        userId: Number(user.id),
        status: 'PENDING',
        completedStepIds: [],
        authorizedStepIds: [],
      },
    });
  }

  // CDA3:
  // - conserva pasos válidos/completados que siguen autorizados;
  // - elimina automáticamente pasos de permisos perdidos;
  // - también depura IDs antiguos que ya no pertenecen a la lista curada.
  const authorizedStepIds = filterAuthorizedOnboardingStepIds(
    user,
    permissions,
    current.authorizedStepIds,
  );

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

export async function syncAvailableOnboardingSteps(user, suppliedStepIds = []) {
  const permissions = await loadPermissions(user);
  const current = await syncOnboarding(user, permissions);

  const incoming = filterAuthorizedOnboardingStepIds(
    user,
    permissions,
    suppliedStepIds,
  );

  // IMPORTANTE:
  // Los controles visibles ahora solo SE AGREGAN.
  // Nunca borramos un paso válido/completado porque hoy no esté visible:
  // puede depender de una pestaña, modal, estado o datos cargados después.
  const authorizedStepIds = filterAuthorizedOnboardingStepIds(
    user,
    permissions,
    [...current.authorizedStepIds, ...incoming],
  );

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

  if (!current.authorizedStepIds.includes(stepId)) {
    const error = new Error(
      'El paso aún no ha sido registrado como disponible en esta sección.',
    );
    error.status = 409;
    throw error;
  }

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
