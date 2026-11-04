import {
  syncOnboarding,
  syncAvailableOnboardingSteps,
  completeOnboardingStep,
  skipOnboardingSection,
} from '../services/onboarding.service.js';

export async function getOnboarding(req, res) {
  const onboarding = await syncOnboarding(req.user);
  return res.json({ onboarding });
}

export async function syncSteps(req, res) {
  const stepIds = Array.isArray(req.body?.stepIds) ? req.body.stepIds : [];

  if (stepIds.length > 250) {
    return res.status(400).json({ error: 'Demasiados pasos de onboarding.' });
  }

  if (stepIds.some((stepId) => typeof stepId !== 'string' || stepId.length > 160)) {
    return res.status(400).json({ error: 'Lista de pasos de onboarding inválida.' });
  }

  const onboarding = await syncAvailableOnboardingSteps(req.user, stepIds);
  return res.json({ onboarding });
}

export async function completeStep(req, res) {
  try {
    const onboarding = await completeOnboardingStep(
      req.user,
      req.params.stepId,
    );
    return res.json({ onboarding });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    throw error;
  }
}

export async function skip(req, res) {
  try {
    const onboarding = await skipOnboardingSection(req.user, req.params.section);
    return res.json({ onboarding });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    throw error;
  }
}
