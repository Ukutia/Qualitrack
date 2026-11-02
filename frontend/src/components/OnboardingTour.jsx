import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  discoverOnboardingControls,
  onboardingSectionForPath,
  pendingControls,
} from '../lib/onboarding.js';

const SUBSECTION_STEPS = new Set([
  'ui:app:hitos-de-acreditacion',
  'ui:documents:carpetas',
]);

function rectFor(element) {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function sameIds(a, b) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export default function OnboardingTour() {
  const { pathname } = useLocation();
  const {
    onboarding,
    completeOnboardingStep,
    skipOnboarding,
    syncOnboardingSteps,
  } = useAuth();

  const section = onboardingSectionForPath(pathname);
  const [controls, setControls] = useState([]);
  const [currentStepId, setCurrentStepId] = useState(null);
  const [targetRect, setTargetRect] = useState(null);
  const [saving, setSaving] = useState(false);
  const syncTimer = useRef(null);
  const lastSyncedIds = useRef([]);

  const pending = useMemo(
    () => pendingControls(controls, onboarding),
    [controls, onboarding],
  );

  const current =
    pending.find((control) => control.id === currentStepId) ??
    pending[0] ??
    null;

  useEffect(() => {
    setControls([]);
    setCurrentStepId(null);
    setTargetRect(null);
    lastSyncedIds.current = [];
  }, [pathname]);

  useEffect(() => {
    if (!section) return undefined;

    const main = document.querySelector('main');
    if (!main) return undefined;

    let cancelled = false;

    async function scanAndSync() {
      if (cancelled) return;

      const discovered = discoverOnboardingControls(pathname, main);
      setControls(discovered);

      const ids = discovered.map((control) => control.id).sort();
      const signature = [`__section:${section}`, ...ids];

      if (!sameIds(signature, lastSyncedIds.current)) {
        lastSyncedIds.current = signature;
        try {
          await syncOnboardingSteps(signature);
        } catch {
          // La guía no debe bloquear la aplicación si falla la sincronización.
        }
      }
    }

    function scheduleScan() {
      window.clearTimeout(syncTimer.current);
      syncTimer.current = window.setTimeout(scanAndSync, 120);
    }

    scanAndSync();

    const observer = new MutationObserver(scheduleScan);
    observer.observe(main, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'aria-disabled', 'class', 'hidden'],
    });

    window.addEventListener('resize', scheduleScan);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearTimeout(syncTimer.current);
      window.removeEventListener('resize', scheduleScan);
    };
  }, [pathname, section, syncOnboardingSteps]);

  useEffect(() => {
    if (!current?.element || !document.body.contains(current.element)) {
      setTargetRect(null);
      return;
    }

    setCurrentStepId(current.id);

    function refresh() {
      if (!current.element || !document.body.contains(current.element)) {
        setTargetRect(null);
        return;
      }
      setTargetRect(rectFor(current.element));
    }

    current.element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    refresh();

    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);

    const resizeObserver = new ResizeObserver(refresh);
    resizeObserver.observe(current.element);

    return () => {
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
      resizeObserver.disconnect();
    };
  }, [current]);

  if (
    !section ||
    onboarding?.status === 'SKIPPED' ||
    !current ||
    !targetRect
  ) {
    return null;
  }

  const authorized = new Set(onboarding?.authorizedStepIds ?? []);
  const sectionControls = controls.filter((control) => authorized.has(control.id));
  const index = sectionControls.findIndex((control) => control.id === current.id);

  async function handleNext() {
    if (saving) return;

    try {
      setSaving(true);
      const subsectionTrigger = SUBSECTION_STEPS.has(current.id)
        ? current.element
        : null;
      await completeOnboardingStep(current.id);
      if (
        subsectionTrigger &&
        document.body.contains(subsectionTrigger) &&
        !subsectionTrigger.disabled
      ) {
        subsectionTrigger.click();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    if (saving) return;

    try {
      setSaving(true);
      await skipOnboarding();
      setTargetRect(null);
      setCurrentStepId(null);
    } finally {
      setSaving(false);
    }
  }

  const tooltipHeight = 230;
  const below = targetRect.top + targetRect.height + 16;
  const tooltipTop =
    below + tooltipHeight <= window.innerHeight
      ? below
      : Math.max(16, targetRect.top - tooltipHeight - 16);

  const tooltipLeft = Math.min(
    Math.max(16, targetRect.left),
    Math.max(16, window.innerWidth - 376),
  );

  return (
    <>
      <div
        className="fixed inset-0 z-[90] bg-black/50"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none fixed z-[91] rounded-xl ring-4 ring-gold-400"
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
        data-onboarding-ignore="true"
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
              {current.title}
            </h2>
          </div>

          <span className="shrink-0 rounded-full bg-steel-100 px-2.5 py-1 text-xs text-steel-600">
            {index + 1} / {sectionControls.length}
          </span>
        </div>

        <p className="text-sm leading-6 text-steel-600">
          {current.description}
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
            onClick={handleNext}
            disabled={saving}
            className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Guardando...' : pending.length === 1 ? 'Entendido' : 'Siguiente'}
          </button>
        </div>
      </div>
    </>
  );
}
