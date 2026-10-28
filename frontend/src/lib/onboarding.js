export const ONBOARDING_UI_STEPS = [
  {
    id: 'tablero.ver',
    path: '/app',
    title: 'Tablero',
    description:
      'Aquí puedes revisar el estado general del proceso de aseguramiento de la calidad.',
    target: '[data-onboarding="tablero-ver"]',
  },
  {
    id: 'hitos.gestionar',
    path: '/app',
    title: 'Gestión de hitos',
    description:
      'Desde aquí puedes acceder a los hitos y realizar su seguimiento.',
    target: '[data-onboarding="hitos-gestionar"]',
  },

  {
    id: 'repositorio.ver',
    path: '/documents',
    title: 'Repositorio',
    description:
      'Aquí puedes consultar los documentos disponibles en Qualitrack.',
    target: '[data-onboarding="repositorio-ver"]',
  },
  {
    id: 'repositorio.gestionar',
    path: '/documents',
    title: 'Gestión del repositorio',
    description:
      'Estas acciones te permiten administrar documentos del repositorio.',
    target: '[data-onboarding="repositorio-gestionar"]',
  },

  {
    id: 'solicitudes.ver',
    path: '/requests',
    title: 'Solicitudes de documentos',
    description:
      'Aquí puedes revisar las solicitudes de documentos existentes.',
    target: '[data-onboarding="solicitudes-ver"]',
  },
  {
    id: 'solicitudes.crear',
    path: '/requests',
    title: 'Crear solicitud',
    description:
      'Utiliza este botón para generar una nueva solicitud de documentos.',
    target: '[data-onboarding="solicitudes-crear"]',
  },
  {
    id: 'solicitudes.gestionar',
    path: '/requests',
    title: 'Gestionar solicitudes',
    description:
      'Desde estas acciones puedes administrar las solicitudes existentes.',
    target: '[data-onboarding="solicitudes-gestionar"]',
  },

  {
    id: 'busqueda.buscar',
    path: '/search',
    title: 'Búsqueda temática',
    description:
      'Aquí puedes realizar búsquedas sobre la evidencia disponible.',
    target: '[data-onboarding="busqueda-buscar"]',
  },
  {
    id: 'busqueda.gestionar-temas',
    path: '/search',
    title: 'Temas',
    description:
      'Estas acciones permiten administrar los temas utilizados en las búsquedas.',
    target: '[data-onboarding="busqueda-gestionar"]',
  },

  {
    id: 'carga.seleccionar',
    path: '/upload',
    title: 'Seleccionar documentos',
    description:
      'Selecciona los documentos que quieres incorporar a Qualitrack.',
    target: '[data-onboarding="carga-seleccionar"]',
  },
  {
    id: 'carga.subir',
    path: '/upload',
    title: 'Cargar evidencia',
    description:
      'Cuando los documentos estén preparados, utiliza esta acción para cargarlos.',
    target: '[data-onboarding="carga-subir"]',
  },

  {
    id: 'informe.ver',
    path: '/structure',
    title: 'Estructura del informe',
    description:
      'Aquí puedes consultar la estructura definida para el informe.',
    target: '[data-onboarding="informe-ver"]',
  },
  {
    id: 'informe.editar',
    path: '/report',
    title: 'Redacción del informe',
    description:
      'Desde esta sección puedes trabajar sobre el contenido del informe.',
    target: '[data-onboarding="informe-editar"]',
  },

  {
    id: 'nube.ver',
    path: '/cloud',
    title: 'Google Drive',
    description:
      'Aquí puedes revisar la integración con la plataforma documental.',
    target: '[data-onboarding="nube-ver"]',
  },
  {
    id: 'nube.importar',
    path: '/cloud',
    title: 'Importar documentos',
    description:
      'Utiliza esta acción para incorporar documentos desde Google Drive.',
    target: '[data-onboarding="nube-importar"]',
  },
];

export function onboardingStepsForPath(pathname, onboarding) {
  if (!onboarding) return [];

  if (
    onboarding.status === 'SKIPPED' ||
    onboarding.status === 'COMPLETED'
  ) {
    return [];
  }

  const authorized = new Set(onboarding.authorizedStepIds ?? []);
  const completed = new Set(onboarding.completedStepIds ?? []);

  return ONBOARDING_UI_STEPS.filter(
    (step) =>
      step.path === pathname &&
      authorized.has(step.id) &&
      !completed.has(step.id),
  );
}