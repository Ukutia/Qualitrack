import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { onboardingStepsForPath } from '../lib/onboarding.js';

export default function OnboardingTour() {
  const { pathname } = useLocation();

  const {
    onboarding,
    completeOnboardingStep,
    skipOnboarding,
  } = useAuth();

  const [currentStepId, setCurrentStepId] = useState(null);
  const [targetRect, setTargetRect] = useState(null);
  const [saving, setSaving] = useState(false);

  const steps = useMemo(
    () => onboardingStepsForPath(pathname, onboarding),
    [pathname, onboarding],
  );

  useEffect(() => {
    if (!steps.length) {
      setCurrentStepId(null);
      return;
    }

    const stillAvailable = steps.some(
      (step) => step.id === currentStepId,
    );

    if (!stillAvailable) {
      setCurrentStepId(steps[0].id);
    }
  }, [steps, currentStepId]);

  const currentStep =
    steps.find((step) => step.id === currentStepId) ?? null;

  useEffect(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }

    let attempts = 0;

    function updateTargetRect(element) {
      const rect = element.getBoundingClientRect();

      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }

    function findTarget() {
      const element = document.querySelector(currentStep.target);

      if (element) {
        updateTargetRect(element);

        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });

        return;
      }

      attempts += 1;

      if (attempts < 10) {
        window.setTimeout(findTarget, 150);
      } else {
        setTargetRect(null);
      }
    }

    findTarget();

    function refreshPosition() {
      const element = document.querySelector(currentStep.target);

      if (!element) return;

      updateTargetRect(element);
    }

    window.addEventListener('resize', refreshPosition);
    window.addEventListener('scroll', refreshPosition, true);

    return () => {
      window.removeEventListener('resize', refreshPosition);
      window.removeEventListener('scroll', refreshPosition, true);
    };
  }, [currentStep]);

  if (!currentStep || !targetRect) {
    return null;
  }

  const currentIndex = steps.findIndex(
    (step) => step.id === currentStep.id,
  );

  const isLastStep =
    currentIndex === steps.length - 1;

  async function handleNext() {
    if (saving || !currentStep || isLastStep) return;

    const nextStep = steps[currentIndex + 1];

    try {
      setSaving(true);

      await completeOnboardingStep(currentStep.id);

      setCurrentStepId(nextStep?.id ?? null);
    } finally {
      setSaving(false);
    }
  }

  async function handleFinish() {
    if (saving || !currentStep) return;

    try {
      setSaving(true);

      await completeOnboardingStep(currentStep.id);

      setCurrentStepId(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    if (saving) return;

    try {
      setSaving(true);

      await skipOnboarding();

      setCurrentStepId(null);
    } finally {
      setSaving(false);
    }
  }

  const currentPosition =
    currentIndex >= 0
      ? currentIndex + 1
      : 1;

  const tooltipTop =
    targetRect.top + targetRect.height + 16;

  const tooltipLeft = Math.min(
    Math.max(16, targetRect.left),
    window.innerWidth - 376,
  );

  return (
    <>
      <div
        className="fixed inset-0 z-[90] bg-black/50"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none fixed z-[91] rounded-xl ring-4 ring-gold-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.05)]"
        style={{
          top: targetRect.top - 6,
          left: targetRect.left - 6,
          width: targetRect.width + 12,
          height: targetRect.height + 12,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Guía de Qualitrack"
        className="fixed z-[92] w-[360px] max-w-[calc(100vw-32px)] rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/10"
        style={{
          top: tooltipTop,
          left: tooltipLeft,
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-600">
              Guía de inicio
            </p>

            <h2 className="mt-1 text-lg font-semibold text-ink-900">
              {currentStep.title}
            </h2>
          </div>

          <span className="shrink-0 rounded-full bg-steel-100 px-2.5 py-1 text-xs text-steel-600">
            {currentPosition} / {steps.length}
          </span>
        </div>

        <p className="text-sm leading-6 text-steel-600">
          {currentStep.description}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="text-sm font-medium text-steel-500 hover:text-steel-800 disabled:opacity-50"
          >
            Omitir guía
          </button>

          <button
            type="button"
            onClick={
              isLastStep
                ? handleFinish
                : handleNext
            }
            disabled={saving}
            className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? 'Guardando...'
              : isLastStep
                ? 'Entendido'
                : 'Siguiente'}
          </button>
        </div>
      </div>
    </>
  );
}