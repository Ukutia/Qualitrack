const SECTION_BY_PATH = [
  [/^\/app\/?$/, 'app'],
  [/^\/milestones\/?$/, 'milestones'],
  [/^\/documents\/\d+\/pasajes\/\d+\/?$/, 'document-detail'],
  [/^\/documents\/\d+\/?$/, 'document-detail'],
  [/^\/documents\/?$/, 'documents'],
  [/^\/requests\/new\/?$/, 'requests-new'],
  [/^\/requests\/?$/, 'requests'],
  [/^\/search\/?$/, 'search'],
  [/^\/upload\/?$/, 'upload'],
  [/^\/structure\/?$/, 'structure'],
  [/^\/report\/?$/, 'report'],
  [/^\/cloud\/?$/, 'cloud'],
  [/^\/trash\/?$/, 'trash'],
  [/^\/security-events\/?$/, 'security-events'],
  [/^\/team\/?$/, 'team'],
];

const SECTION_DESCRIPTIONS = {
  app: {
    'subcriterios': ['Ver subcriterios', 'Consulta el estado de cumplimiento de los subcriterios del criterio evaluado.'],
    'hitos-de-acreditacion': ['Ver hitos de acreditación', 'Abre el seguimiento de hitos, fechas límite y responsables del proceso.'],
    'registrar-hito': ['Registrar un hito', 'Crea un nuevo hito con fecha límite, responsable y tareas asociadas.'],
    'modificar': ['Modificar un hito', 'Actualiza la información de un hito que todavía está activo.'],
    'marcar-completado': ['Completar un hito', 'Marca el hito como completado cuando su trabajo ya terminó.'],
  },

  milestones: {
    'registrar-hito': ['Registrar un hito', 'Crea un nuevo hito con fecha límite, responsable y tareas asociadas.'],
    'modificar': ['Modificar un hito', 'Actualiza la información de un hito activo.'],
    'marcar-completado': ['Completar un hito', 'Finaliza un hito cuando sus tareas ya fueron realizadas.'],
  },

  documents: {
    'todos': ['Ver todos los documentos', 'Muestra todas las evidencias disponibles, sin agruparlas por carpeta.'],
    'carpetas': ['Organizar por carpetas', 'Cambia al modo de carpetas para ordenar las evidencias del repositorio.'],
    'lista': ['Vista en lista', 'Muestra los documentos en formato de lista.'],
    'mosaico': ['Vista en mosaico', 'Muestra los documentos como tarjetas para una revisión más visual.'],
    'filtros': ['Filtrar evidencias', 'Acota el repositorio por nombre, origen, responsable, subcriterio o estado.'],
    'limpiar-filtros': ['Limpiar filtros', 'Restablece la vista del repositorio quitando los filtros aplicados.'],
    'crear-carpeta': ['Crear carpeta', 'Agrupa las evidencias seleccionadas dentro de una nueva carpeta.'],
    'mover': ['Mover elementos', 'Cambia documentos o carpetas de ubicación dentro del repositorio.'],
    'renombrar': ['Renombrar', 'Cambia el nombre de un documento o carpeta sin modificar su contenido.'],
    'mover-a-papelera': ['Enviar a papelera', 'Retira una evidencia del repositorio sin eliminarla definitivamente.'],
    'papelera': ['Abrir papelera', 'Revisa las evidencias eliminadas para restaurarlas o borrarlas definitivamente.'],
    'cargar-evidencia': ['Cargar evidencia', 'Abre la sección para incorporar nuevos documentos al repositorio.'],
  },

  'document-detail': {
    'validar': ['Validar clasificación', 'Confirma que la evidencia corresponde al subcriterio propuesto.'],
    'rechazar': ['Rechazar clasificación', 'Descarta la clasificación propuesta cuando no corresponde.'],
    'reasignar': ['Reasignar evidencia', 'Asocia manualmente la evidencia a otro subcriterio.'],
    'reclasificar': ['Reclasificar evidencia', 'Solicita nuevamente el análisis de clasificación del documento.'],
    'volver': ['Volver al repositorio', 'Regresa al listado general de evidencias.'],
  },

  requests: {
    'crear-solicitud': ['Crear solicitud', 'Solicita un documento a una persona externa y define la frecuencia de recordatorio.'],
    'copiar-link': ['Copiar enlace de entrega', 'Copia el enlace público vigente para compartirlo con la persona destinataria.'],
    'pausar': ['Pausar solicitud', 'Detiene temporalmente los recordatorios y deja sin efecto el enlace vigente.'],
    'reanudar': ['Reanudar solicitud', 'Reactiva una solicitud pausada y genera un nuevo enlace de entrega.'],
    'cancelar': ['Cancelar solicitud', 'Finaliza la solicitud e invalida su enlace vigente.'],
    'eliminar': ['Eliminar solicitud', 'Elimina una solicitud que ya no necesitas conservar.'],
  },

  'requests-new': {
    'crear-solicitud': ['Confirmar solicitud', 'Crea la solicitud con el destinatario, descripción y frecuencia indicados.'],
    'volver': ['Volver a solicitudes', 'Regresa al listado sin crear una nueva solicitud.'],
  },

  search: {
    'lista': ['Vista en lista', 'Explora las coincidencias de evidencia en una lista ordenada.'],
    'red-visual': ['Red visual', 'Explora gráficamente la relación entre temáticas y evidencias.'],
    'agregar-tematica': ['Agregar temática', 'Guarda una nueva temática para reutilizarla en futuras búsquedas.'],
    'buscar-tematica': ['Buscar una temática', 'Ejecuta la búsqueda semántica usando una temática guardada.'],
    'eliminar-tematica': ['Eliminar temática', 'Quita una temática guardada cuando ya no sea necesaria.'],
  },

  upload: {
    'seleccionar-archivos': ['Seleccionar archivos', 'Elige uno o más documentos desde tu equipo para incorporarlos a Qualitrack.'],
    'quitar': ['Quitar archivo', 'Retira un archivo de la selección antes de iniciar la carga.'],
    'cargar-documentos': ['Cargar documentos', 'Inicia la carga de todos los archivos pendientes de la selección.'],
    'limpiar-lista': ['Limpiar selección', 'Quita todos los archivos de la lista antes de cargarlos.'],
    'restaurar-existente': ['Restaurar existente', 'Recupera desde la papelera el documento que ya existía.'],
    'reemplazar': ['Reemplazar documento', 'Sustituye el documento existente por el archivo que intentas cargar.'],
    'conservar-ambos': ['Conservar ambos', 'Mantiene tanto el documento existente como el nuevo archivo.'],
    'omitir-archivo': ['Omitir archivo', 'Descarta este archivo y continúa con los demás.'],
  },

  structure: {
    'historial': ['Historial de estructura', 'Consulta las versiones anteriores de la estructura oficial del informe.'],
    'importar-documento': ['Importar estructura', 'Carga un documento oficial para detectar automáticamente sus secciones.'],
    'editar-nueva-version': ['Editar estructura', 'Modifica manualmente la estructura y crea una nueva versión al guardar.'],
    'restaurar': ['Restaurar versión', 'Crea una nueva versión usando como base una estructura anterior.'],
    'confirmar-guardar': ['Guardar estructura detectada', 'Guarda directamente las secciones detectadas como una nueva versión.'],
    'revisar-editar': ['Revisar antes de guardar', 'Lleva las secciones detectadas al editor para revisarlas antes de guardar.'],
    'agregar-seccion': ['Agregar sección', 'Añade una nueva sección a la estructura del informe.'],
    'guardar-nueva-version': ['Guardar nueva versión', 'Publica los cambios de estructura como una nueva versión.'],
    'reordenar-seccion': ['Reordenar secciones', 'Cambia el orden de las secciones antes de guardar la nueva versión.'],
    'eliminar-seccion': ['Eliminar sección', 'Quita una sección de la nueva versión que estás preparando.'],
  },

  report: {
    'nuevo-borrador': ['Crear borrador', 'Crea un nuevo borrador de informe para comenzar a redactar.'],
    'seleccionar-borrador': ['Abrir un borrador', 'Selecciona un borrador existente para continuar trabajando en él.'],
    'eliminar-borrador': ['Eliminar borrador', 'Elimina definitivamente un borrador que ya no necesitas.'],
    'generacion-secciones-ia': ['Generación de secciones con IA', 'Abre las herramientas para configurar y generar contenido asistido por IA.'],
    'anadir-seccion-ia': ['Añadir regla de generación', 'Crea una nueva sección de generación con instrucciones personalizadas para la IA.'],
    'importar-reglas': ['Importar reglas', 'Carga reglas de generación desde un documento externo.'],
    'guardar-configuracion': ['Guardar configuración', 'Guarda el nombre, propósito e instrucciones de la sección de generación activa.'],
    'eliminar-configuracion': ['Eliminar configuración', 'Elimina la regla de generación seleccionada.'],
    'generar-vista-previa': ['Generar vista previa', 'Genera una propuesta de texto usando las evidencias seleccionadas.'],
    'detectar-incoherencias': ['Detectar incoherencias', 'Compara las evidencias seleccionadas para identificar posibles contradicciones.'],
    'insertar-texto': ['Insertar texto generado', 'Inserta en el borrador el contenido generado que decidiste conservar.'],
    'buscar-coincidencias': ['Buscar coincidencias', 'Busca evidencia relacionada con el fragmento de texto que seleccionaste.'],
    'insertar-evidencia': ['Insertar evidencia', 'Inserta en el borrador un fragmento relevante encontrado en el repositorio.'],
    'historial': ['Historial del borrador', 'Consulta versiones anteriores del borrador para revisar o restaurar cambios.'],
    'restaurar-version': ['Restaurar versión', 'Recupera una versión anterior del borrador.'],
    'exportar-pdf': ['Exportar a PDF', 'Genera una versión PDF del borrador actual.'],
    'exportar-docx': ['Exportar a Word', 'Descarga el borrador actual como documento Word.'],
  },

  cloud: {
    'conectar': ['Conectar almacenamiento', 'Vincula tu cuenta de almacenamiento para explorar sus archivos desde Qualitrack.'],
    'atras': ['Volver a carpeta anterior', 'Regresa al nivel anterior del almacenamiento conectado.'],
    'seleccionar': ['Seleccionar archivos', 'Activa la selección múltiple para importar varias evidencias a la vez.'],
    'importar-seleccionados': ['Importar seleccionados', 'Importa en una sola operación los archivos que seleccionaste.'],
    'importar': ['Importar archivo', 'Incorpora el archivo seleccionado al repositorio de Qualitrack.'],
    'reintentar-pendientes': ['Reintentar pendientes', 'Vuelve a intentar únicamente los archivos que fallaron por conexión.'],
    'ir-a-evidencias': ['Ir a evidencias', 'Abre el repositorio para revisar los documentos que acabas de importar.'],
    'desconectar': ['Desconectar cuenta', 'Desvincula la cuenta de almacenamiento de Qualitrack.'],
  },

  trash: {
    'volver-repositorio': ['Volver al repositorio', 'Regresa al repositorio principal de evidencias.'],
    'restaurar': ['Restaurar documento', 'Devuelve el documento seleccionado al repositorio.'],
    'eliminar': ['Eliminar definitivamente', 'Elimina de forma permanente un documento de la papelera.'],
    'restaurar-seleccionados': ['Restaurar seleccionados', 'Recupera en conjunto todos los documentos seleccionados.'],
    'eliminar-seleccionados': ['Eliminar seleccionados', 'Elimina definitivamente todos los documentos seleccionados.'],
  },

  'security-events': {
    'actualizar-registro': ['Actualizar registro', 'Actualiza manualmente el listado de eventos y accesos registrados.'],
    'todos-eventos': ['Ver todos los eventos', 'Muestra la actividad completa registrada por la plataforma.'],
    'accesos-denegados': ['Ver accesos denegados', 'Filtra el registro para revisar intentos de acceso rechazados.'],
    'inicios-sesion': ['Ver inicios de sesión', 'Filtra el registro para revisar eventos de autenticación.'],
    'bloqueos-cuenta': ['Ver bloqueos de cuenta', 'Filtra el registro para revisar bloqueos temporales de usuarios.'],
  },

  team: {
    'incorporar-equipo': ['Incorporar integrante', 'Agrega una persona al equipo y le asigna su rol inicial.'],
    'eliminar-integrante': ['Eliminar integrante', 'Revoca el acceso de un integrante conservando la trazabilidad de sus acciones.'],
  },
};

export function onboardingSectionForPath(pathname) {
  return SECTION_BY_PATH.find(([pattern]) => pattern.test(pathname))?.[1] ?? null;
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function elementLabel(element) {
  return normalizeWhitespace(
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.innerText ||
    element.textContent ||
    '',
  );
}

function normalized(value) {
  return normalizeWhitespace(value).toLocaleLowerCase('es-CL');
}

function visible(element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function available(element) {
  return (
    visible(element) &&
    !element.disabled &&
    element.getAttribute('aria-disabled') !== 'true'
  );
}

function firstMatchingKey(section, element, label) {
  const text = normalized(label);

  // Controles que nunca aportan una tarea de onboarding.
  if (
    element.closest('[role="toolbar"], .draft-toolbar') ||
    element.closest('nav[aria-label*="Paginación"], nav[aria-label*="paginación"]') ||
    /^(\d+|← anterior|siguiente →|anterior|siguiente)$/.test(text)
  ) {
    return null;
  }

  if (section === 'app' || section === 'milestones') {
    if (text === 'subcriterios') return 'subcriterios';
    if (text.includes('hitos de acreditación')) return 'hitos-de-acreditacion';
    if (text.includes('registrar hito')) return 'registrar-hito';
    if (text === 'modificar') return 'modificar';
    if (text.includes('marcar completado')) return 'marcar-completado';
    return null;
  }

  if (section === 'documents') {
    if (text === 'todos') return 'todos';
    if (text === 'carpetas') return 'carpetas';
    if (text === 'lista') return 'lista';
    if (text === 'mosaico') return 'mosaico';
    if (text.includes('filtro')) return text.includes('limpiar') ? 'limpiar-filtros' : 'filtros';
    if (text.includes('crear carpeta')) return 'crear-carpeta';
    if (text === 'mover' || text.includes('mover seleccion')) return 'mover';
    if (text.includes('renombr')) return 'renombrar';
    if (text.includes('papelera') && text.includes('mover')) return 'mover-a-papelera';
    if (text === 'papelera' || text.includes('abrir papelera')) return 'papelera';
    if (text.includes('cargar evidencia') || text.includes('subir')) return 'cargar-evidencia';
    return null;
  }

  if (section === 'document-detail') {
    if (text.includes('validar')) return 'validar';
    if (text.includes('rechazar')) return 'rechazar';
    if (text.includes('reasign')) return 'reasignar';
    if (text.includes('reclasific') || text.includes('clasificar nuevamente')) return 'reclasificar';
    if (text.includes('volver')) return 'volver';
    return null;
  }

  if (section === 'requests') {
    if (text.includes('crear solicitud')) return 'crear-solicitud';
    if (text.includes('copiar link') || text.includes('copiar enlace')) return 'copiar-link';
    if (text === 'pausar') return 'pausar';
    if (text === 'reanudar') return 'reanudar';
    if (text === 'cancelar') return 'cancelar';
    if (text === 'eliminar') return 'eliminar';
    return null;
  }

  if (section === 'requests-new') {
    if (text.includes('crear solicitud')) return 'crear-solicitud';
    if (text.includes('volver')) return 'volver';
    return null;
  }

  if (section === 'search') {
    if (text === 'lista') return 'lista';
    if (text === 'red visual') return 'red-visual';
    if (text.includes('agregar temática')) return 'agregar-tematica';
    if (text.startsWith('eliminar temática')) return 'eliminar-tematica';

    // Botones de chips de temáticas guardadas: no repetir una etapa por cada tema.
    if (
      element.parentElement?.matches('.rounded-full') &&
      !text.includes('eliminar')
    ) {
      return 'buscar-tematica';
    }

    return null;
  }

  if (section === 'upload') {
    if (
      element.getAttribute('role') === 'button' &&
      element.getAttribute('aria-label')?.startsWith('Seleccionar archivos')
    ) return 'seleccionar-archivos';
    if (text === 'quitar') return 'quitar';
    if (/^cargar \d+ documento/.test(text) || text === 'cargando…') return 'cargar-documentos';
    if (text.includes('limpiar lista')) return 'limpiar-lista';
    if (text.includes('restaurar el existente')) return 'restaurar-existente';
    if (text === 'reemplazar') return 'reemplazar';
    if (text.includes('conservar ambos')) return 'conservar-ambos';
    if (text.includes('omitir este archivo')) return 'omitir-archivo';
    return null;
  }

  if (section === 'structure') {
    if (text === 'historial') return 'historial';
    if (text.includes('importar desde documento')) return 'importar-documento';
    if (text.includes('editar / nueva versión')) return 'editar-nueva-version';
    if (text === 'restaurar') return 'restaurar';
    if (text.includes('confirmar y guardar')) return 'confirmar-guardar';
    if (text.includes('revisar y editar')) return 'revisar-editar';
    if (text.includes('agregar sección')) return 'agregar-seccion';
    if (text.includes('guardar nueva versión')) return 'guardar-nueva-version';
    if (['subir', 'bajar'].includes(text)) return 'reordenar-seccion';
    if (text.includes('eliminar sección')) return 'eliminar-seccion';
    return null;
  }

  if (section === 'report') {
    // La barra de formato (B, I, U, listas, undo/redo) ya fue excluida arriba.
    // Tampoco se hace onboarding de cada sección oficial ni de cada regla IA.
    if (element.closest('.draft-library-list')) {
      if (text.startsWith('eliminar borrador')) return 'eliminar-borrador';
      if (element.matches('button')) return 'seleccionar-borrador';
    }

    if (text.includes('generación de secciones')) return 'generacion-secciones-ia';
    if (text.includes('nuevo borrador')) return 'nuevo-borrador';
    if (text.includes('añadir sección')) return 'anadir-seccion-ia';
    if (text.includes('importar reglas')) return 'importar-reglas';
    if (text.includes('guardar configuración')) return 'guardar-configuracion';
    if (text.includes('eliminar sección') || text.includes('eliminar configuración')) return 'eliminar-configuracion';
    if (text.includes('generar vista previa') || text === 'generar') return 'generar-vista-previa';
    if (text.includes('incoherencia')) return 'detectar-incoherencias';
    if (text.includes('insertar texto') || text.includes('insertar generación')) return 'insertar-texto';
    if (text.includes('buscar coincidencias')) return 'buscar-coincidencias';
    if (text.includes('insertar evidencia')) return 'insertar-evidencia';
    if (text === 'historial' || text.includes('ver historial')) return 'historial';
    if (text.includes('restaurar')) return 'restaurar-version';
    if (text.includes('pdf')) return 'exportar-pdf';
    if (text.includes('docx') || text.includes('word')) return 'exportar-docx';

    // Todo botón cuyo texto sea el nombre de una sección del informe se omite.
    return null;
  }

  if (section === 'cloud') {
    if (text.startsWith('conectar ')) return 'conectar';
    if (text === '← atrás' || text === 'atrás') return 'atras';
    if (text === 'seleccionar' || text === 'cancelar selección') return 'seleccionar';
    if (text.includes('importar seleccionados')) return 'importar-seleccionados';
    if (text === 'importar') return 'importar';
    if (text.includes('reintentar pendientes')) return 'reintentar-pendientes';
    if (text.includes('ir a evidencias')) return 'ir-a-evidencias';
    if (text.includes('desconectar')) return 'desconectar';
    return null;
  }

  if (section === 'trash') {
    if (text.includes('volver al repositorio')) return 'volver-repositorio';
    if (text === 'restaurar') return 'restaurar';
    if (text === 'eliminar') return 'eliminar';
    if (text.includes('restaurar seleccionados')) return 'restaurar-seleccionados';
    if (text.includes('eliminar seleccionados')) return 'eliminar-seleccionados';
    return null;
  }

  if (section === 'security-events') {
    if (text.includes('actualizar registro') || text === 'actualizando…') return 'actualizar-registro';
    if (text === 'todos los eventos') return 'todos-eventos';
    if (text === 'accesos denegados') return 'accesos-denegados';
    if (text === 'inicios de sesión') return 'inicios-sesion';
    if (text === 'bloqueos de cuenta') return 'bloqueos-cuenta';
    return null;
  }

  if (section === 'team') {
    if (text.includes('incorporar al equipo') || text === 'incorporando…') return 'incorporar-equipo';
    if (text.startsWith('eliminar a ') || text.includes('eliminar integrante')) return 'eliminar-integrante';

    // Los <select> de permisos no se incluyen: el onboarding se centra en
    // las tareas principales de esta HU, no en cada celda de la matriz.
    return null;
  }

  return null;
}

export function discoverOnboardingControls(pathname, root = document.querySelector('main')) {
  const section = onboardingSectionForPath(pathname);
  const descriptions = SECTION_DESCRIPTIONS[section];

  if (!section || !descriptions || !root) return [];

  const candidates = Array.from(
    root.querySelectorAll('button, [role="button"], a.btn'),
  ).filter(available);

  const byFunction = new Map();

  for (const element of candidates) {
    const label = elementLabel(element);
    const key = firstMatchingKey(section, element, label);

    if (!key || !descriptions[key] || byFunction.has(key)) continue;

    const [title, description] = descriptions[key];
    const id = `ui:${section}:${key}`;

    element.setAttribute('data-onboarding-step-id', id);

    byFunction.set(key, {
      id,
      section,
      key,
      title,
      description,
      element,
    });
  }

  return [...byFunction.values()];
}

export function pendingControls(controls, onboarding) {
  if (!onboarding || onboarding.status === 'SKIPPED') return [];

  const authorized = new Set(onboarding.authorizedStepIds ?? []);
  const completed = new Set(onboarding.completedStepIds ?? []);

  return controls.filter(
    (control) =>
      authorized.has(control.id) &&
      !completed.has(control.id),
  );
}
