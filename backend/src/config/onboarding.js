import { MODULES, LEVELS, levelSatisfies } from "./permissions.js";

/**
 * HU23 — Pasos funcionales del onboarding.
 *
 * El backend solo conoce:
 * - id estable del paso
 * - módulo al que pertenece
 * - permiso mínimo necesario
 *
 * Los textos y el elemento visual que se resaltará quedan en frontend.
 */
export const ONBOARDING_STEPS = [
  // Tablero e hitos
  {
    id: "tablero.ver",
    module: MODULES.TABLERO,
    level: LEVELS.LECTURA,
  },
  {
    id: "hitos.gestionar",
    module: MODULES.TABLERO,
    level: LEVELS.ESCRITURA,
  },

  // Repositorio
  {
    id: "repositorio.ver",
    module: MODULES.REPOSITORIO,
    level: LEVELS.LECTURA,
  },
  {
    id: "repositorio.gestionar",
    module: MODULES.REPOSITORIO,
    level: LEVELS.ESCRITURA,
  },

  // Solicitudes
  {
    id: "solicitudes.ver",
    module: MODULES.SOLICITUDES,
    level: LEVELS.LECTURA,
  },
  {
    id: "solicitudes.crear",
    module: MODULES.SOLICITUDES,
    level: LEVELS.ESCRITURA,
  },
  {
    id: "solicitudes.gestionar",
    module: MODULES.SOLICITUDES,
    level: LEVELS.ESCRITURA,
  },

  // Búsqueda temática
  {
    id: "busqueda.buscar",
    module: MODULES.BUSQUEDA,
    level: LEVELS.LECTURA,
  },
  {
    id: "busqueda.gestionar-temas",
    module: MODULES.BUSQUEDA,
    level: LEVELS.ESCRITURA,
  },

  // Cargar evidencia
  {
    id: "carga.seleccionar",
    module: MODULES.CARGA,
    level: LEVELS.ESCRITURA,
  },
  {
    id: "carga.subir",
    module: MODULES.CARGA,
    level: LEVELS.ESCRITURA,
  },

  // Informe
  {
    id: "informe.ver",
    module: MODULES.INFORME,
    level: LEVELS.LECTURA,
  },
  {
    id: "informe.editar",
    module: MODULES.INFORME,
    level: LEVELS.ESCRITURA,
  },

  // Nube
  {
    id: "nube.ver",
    module: MODULES.NUBE,
    level: LEVELS.LECTURA,
  },
  {
    id: "nube.importar",
    module: MODULES.NUBE,
    level: LEVELS.ESCRITURA,
  },
];

/**
 * Retorna únicamente los pasos que corresponden a los permisos efectivos
 * actuales del usuario.
 */
export function authorizedOnboardingStepIds(permissions = {}) {
  return ONBOARDING_STEPS.filter((step) =>
    levelSatisfies(permissions[step.module] ?? LEVELS.DENEGADO, step.level),
  ).map((step) => step.id);
}

/**
 * Permite verificar que un paso realmente pertenece al catálogo.
 */
export function isKnownOnboardingStep(stepId) {
  return ONBOARDING_STEPS.some((step) => step.id === stepId);
}
