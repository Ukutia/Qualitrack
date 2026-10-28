import {
  syncOnboarding,
  completeOnboardingStep,
  skipOnboarding,
} from '../services/onboarding.service.js';

/**
 * Devuelve el onboarding actualizado según los permisos actuales.
 */
export async function getOnboarding(req, res) {
  const onboarding = await syncOnboarding(req.user);
  return res.json({ onboarding });
}

/**
 * Marca una etapa visual como completada.
 */
export async function completeStep(req, res) {
  try {
    const onboarding = await completeOnboardingStep(
      req.user,
      req.params.stepId,
    );

    return res.json({ onboarding });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
      });
    }

    throw error;
  }
}

/**
 * CDA2 — Omitir la guía.
 */
export async function skip(req, res) {
  const onboarding = await skipOnboarding(req.user);
  return res.json({ onboarding });
}