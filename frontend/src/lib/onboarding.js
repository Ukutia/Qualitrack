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
    'subcriterios': ['Subpestaña Subcriterios', 'Consulta el estado de cumplimiento de los subcriterios del criterio evaluado.'],
    'hitos-de-acreditacion': ['Subpestaña Hitos de acreditación', 'Abre el seguimiento de hitos, fechas límite y responsables. Al continuar, la guía abrirá esta subpestaña y explicará sus controles.'],
    'registrar-hito': ['Registrar un hito', 'Abre el formulario para indicar título y fecha, elegir al responsable en una lista desplegable y agregar las tareas asociadas.'],
    'responsable-hito': ['Responsable del hito', 'Selecciona en la lista desplegable a la persona responsable de ejecutar y dar seguimiento al hito.'],
    'modificar': ['Modificar un hito', 'Actualiza la información de un hito que todavía está activo.'],
    'marcar-completado': ['Completar un hito', 'Marca el hito como completado cuando su trabajo ya terminó.'],
  },

  milestones: {
    'registrar-hito': ['Registrar un hito', 'Abre el formulario para indicar título y fecha, elegir al responsable en una lista desplegable y agregar las tareas asociadas.'],
    'responsable-hito': ['Responsable del hito', 'Selecciona en la lista desplegable a la persona responsable de ejecutar y dar seguimiento al hito.'],
    'modificar': ['Modificar un hito', 'Actualiza la información de un hito activo.'],
    'marcar-completado': ['Completar un hito', 'Finaliza un hito cuando sus tareas ya fueron realizadas.'],
  },

  documents: {
    'todos': ['Ver todos los documentos', 'Muestra todas las evidencias disponibles, sin agruparlas por carpeta.'],
    'carpetas': ['Subpestaña Carpetas', 'Cambia al explorador de carpetas. Al continuar, la guía abrirá esta subpestaña y explicará sus controles propios.'],
    'ordenar': ['Ordenar repositorio', 'Usa esta lista desplegable para ordenar los elementos por fecha reciente o por nombre de la A a la Z.'],
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
    'seleccionar-subcriterio': ['Seleccionar subcriterio', 'Elige en la lista desplegable el nivel y subcriterio al que deseas reasignar manualmente la evidencia.'],
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
    'red-visual': ['Red visual', 'Explora gráficamente la relación entre temáticas y evidencias; dentro de la red puedes enfocar una temática desde su lista desplegable.'],
    'agregar-tematica': ['Agregar temática', 'Guarda una nueva temática para reutilizarla en futuras búsquedas.'],
    'buscar-tematica': ['Buscar una temática', 'Ejecuta la búsqueda semántica usando una temática guardada.'],
    'eliminar-tematica': ['Eliminar temática', 'Quita una temática guardada cuando ya no sea necesaria.'],
    'seleccionar-tematica-red': ['Temática de la red', 'Selecciona una temática en la lista desplegable para enfocar la red y sus documentos relacionados, o elige todas para ver el conjunto.'],
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
    'nuevo-borrador': ['Crear borrador', 'Crea un borrador para comenzar a redactar; en el editor podrás elegir el estilo de párrafo desde una lista desplegable.'],
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
    'estilo-parrafo': ['Estilo de párrafo', 'Elige en la lista desplegable entre texto normal, título principal, título de sección o subtítulo.'],
  },

  cloud: {
    'conectar': ['Conectar almacenamiento', 'Vincula tu cuenta para explorar sus archivos; una vez conectada, podrás filtrarlos por tipo desde una lista desplegable.'],
    'atras': ['Volver a carpeta anterior', 'Regresa al nivel anterior del almacenamiento conectado.'],
    'seleccionar': ['Seleccionar archivos', 'Activa la selección múltiple para importar varias evidencias a la vez.'],
    'importar-seleccionados': ['Importar seleccionados', 'Importa en una sola operación los archivos que seleccionaste.'],
    'importar': ['Importar archivo', 'Incorpora el archivo seleccionado al repositorio de Qualitrack.'],
    'reintentar-pendientes': ['Reintentar pendientes', 'Vuelve a intentar únicamente los archivos que fallaron por conexión.'],
    'ir-a-evidencias': ['Ir a evidencias', 'Abre el repositorio para revisar los documentos que acabas de importar.'],
    'desconectar': ['Desconectar cuenta', 'Desvincula la cuenta de almacenamiento de Qualitrack.'],
    'filtrar-tipo-archivo': ['Filtrar por tipo de archivo', 'Usa la lista desplegable para mostrar todos los archivos o limitar la carpeta a un formato específico.'],
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
    'filas-por-pagina': ['Filas por página', 'Selecciona en la lista desplegable cuántos eventos mostrar en cada página del registro.'],
  },

  team: {
    'incorporar-equipo': ['Incorporar integrante', 'Agrega una persona al equipo y selecciona su rol inicial desde la lista desplegable del formulario.'],
    'eliminar-integrante': ['Eliminar integrante', 'Revoca el acceso de un integrante conservando la trazabilidad de sus acciones.'],
    'nivel-permiso': ['Permiso por módulo', 'Cada lista desplegable permite dejar el permiso según el rol o asignar lectura, escritura o acceso denegado. Las listas repetidas cumplen la misma función.'],
    'rol-integrante': ['Rol del integrante', 'Selecciona en la lista desplegable el rol inicial que tendrá la persona incorporada.'],
  },
};

const SECTION_INTROS = {
  app: ['Tablero', 'Aquí puedes revisar el estado general del proceso y las tareas de acreditación disponibles para tu rol.'],
  milestones: ['Hitos de acreditación', 'Aquí puedes consultar y gestionar los hitos de acreditación que tienes autorizados.'],
  documents: ['Repositorio de evidencias', 'Aquí puedes buscar, revisar y organizar las evidencias disponibles para tu rol.'],
  'document-detail': ['Detalle de la evidencia', 'Aquí puedes revisar el archivo y realizar las acciones de clasificación que tienes autorizadas.'],
  requests: ['Solicitudes de documentos', 'Aquí puedes revisar y gestionar solicitudes de documentos externos.'],
  'requests-new': ['Nueva solicitud', 'Completa los datos para solicitar un documento y generar su enlace de entrega.'],
  search: ['Búsqueda temática', 'Aquí puedes encontrar evidencias por temática y explorar sus relaciones.'],
  upload: ['Cargar evidencia', 'Aquí puedes seleccionar documentos, resolver duplicados y cargarlos al repositorio.'],
  structure: ['Estructura del informe', 'Aquí puedes consultar y preparar nuevas versiones de la estructura oficial.'],
  report: ['Informe', 'Aquí puedes redactar, generar contenido asistido y exportar el informe.'],
  cloud: ['Almacenamiento en la nube', 'Aquí puedes conectar un proveedor e importar evidencias desde la nube.'],
  trash: ['Papelera', 'Aquí puedes restaurar evidencias o eliminarlas definitivamente.'],
  'security-events': ['Eventos de seguridad', 'Aquí puedes revisar la actividad de acceso y seguridad de Qualitrack.'],
  team: ['Equipo y permisos', 'Aquí puedes administrar integrantes y sus permisos efectivos.'],
};

const EXTRA_DESCRIPTIONS = {
  app: {
    'filtro-en-plazo': ['Hitos en plazo', 'Filtra los hitos que todavía se encuentran dentro de su plazo.'],
    'filtro-por-vencer': ['Hitos por vencer', 'Filtra los hitos cuya fecha límite está próxima.'],
    'filtro-vencidos': ['Hitos vencidos', 'Filtra los hitos que superaron su fecha límite.'],
    'filtro-completados': ['Hitos completados', 'Filtra los hitos que ya fueron terminados.'],
    'ver-todos': ['Ver todos los hitos', 'Quita el filtro de estado y vuelve a mostrar todos los hitos.'],
    'guardar-hito': ['Guardar hito', 'Registra el nuevo hito o guarda los cambios de uno existente.'],
    'cancelar-edicion': ['Cancelar edición', 'Descarta los cambios del hito que estabas editando.'],
    'cerrar-hitos': ['Cerrar hitos', 'Cierra el panel de hitos y vuelve al contenido anterior.'],
    reintentar: ['Reintentar carga', 'Vuelve a solicitar los hitos cuando ocurrió un problema.'],
  },
  milestones: {
    'filtro-en-plazo': ['Hitos en plazo', 'Filtra los hitos que todavía se encuentran dentro de su plazo.'],
    'filtro-por-vencer': ['Hitos por vencer', 'Filtra los hitos cuya fecha límite está próxima.'],
    'filtro-vencidos': ['Hitos vencidos', 'Filtra los hitos que superaron su fecha límite.'],
    'filtro-completados': ['Hitos completados', 'Filtra los hitos que ya fueron terminados.'],
    'guardar-hito': ['Guardar hito', 'Registra el nuevo hito o guarda los cambios de uno existente.'],
    'cancelar-edicion': ['Cancelar edición', 'Descarta los cambios del hito que estabas editando.'],
    'cerrar-hitos': ['Cerrar hitos', 'Cierra el panel de hitos y vuelve al contenido anterior.'],
    reintentar: ['Reintentar carga', 'Vuelve a solicitar los hitos cuando ocurrió un problema.'],
  },
  documents: {
    buscar: ['Buscar evidencias', 'Busca archivos o carpetas por su nombre completo o parcial.'],
    'abrir-carpeta': ['Abrir carpeta', 'Entra a una carpeta del repositorio. Los botones repetidos cumplen la misma función.'],
    'acciones-elemento': ['Acciones del elemento', 'Abre las opciones disponibles para el documento o carpeta: mover, renombrar o eliminar.'],
    'cancelar-crear-carpeta': ['Cancelar nueva carpeta', 'Cierra el formulario sin crear la carpeta.'],
    'guardar-renombre': ['Guardar nombre', 'Confirma el nuevo nombre del documento o carpeta.'],
    'cancelar-renombre': ['Cancelar cambio de nombre', 'Descarta el nuevo nombre y conserva el anterior.'],
    'eliminar-elemento': ['Eliminar elemento', 'Envía un documento a la papelera o abre las alternativas de eliminación de una carpeta.'],
    'eliminar-solo-carpeta': ['Eliminar sólo la agrupación', 'Elimina la carpeta pero conserva sus archivos en el repositorio.'],
    'eliminar-carpeta-con-archivos': ['Eliminar carpeta y archivos', 'Envía a la papelera la carpeta junto con los archivos que contiene.'],
    'cancelar-eliminar-carpeta': ['Cancelar eliminación', 'Cierra la confirmación y conserva la carpeta.'],
    deseleccionar: ['Deseleccionar', 'Quita la selección actual de documentos y carpetas.'],
    'cerrar-mensaje': ['Cerrar mensaje', 'Cierra el aviso mostrado después de una operación del repositorio.'],
    reintentar: ['Reintentar carga', 'Vuelve a solicitar el contenido del repositorio.'],
  },
  'document-detail': {
    'ver-archivo': ['Ver archivo', 'Abre el contenido original de la evidencia para revisarlo; desde esa ventana puedes descargar el original o cerrarla para volver al detalle.'],
    'clasificacion-respaldo': ['Usar clasificación de respaldo', 'Aplica la alternativa de clasificación disponible cuando el análisis principal no termina.'],
    'mover-a-papelera': ['Enviar a papelera', 'Retira esta evidencia del repositorio sin borrarla definitivamente.'],
  },
  search: {
    'cerrar-tematica': ['Cerrar nueva temática', 'Cierra el formulario sin guardar una temática.'],
    'cancelar-tematica': ['Cancelar nueva temática', 'Descarta los datos de la temática que estabas preparando.'],
    'guardar-tematica': ['Guardar temática', 'Guarda la temática para usarla en búsquedas posteriores.'],
    'actualizar-red': ['Actualizar red', 'Vuelve a cargar las relaciones entre temáticas y evidencias.'],
    'reintentar-red': ['Reintentar red', 'Vuelve a solicitar la red cuando ocurrió un problema.'],
    'ver-todos': ['Ver todos', 'Quita el foco actual y muestra todos los nodos de la red.'],
    'abrir-documento': ['Abrir documento', 'Abre la evidencia seleccionada desde la red o los resultados.'],
    alejar: ['Alejar red', 'Reduce el nivel de zoom de la red visual.'],
    acercar: ['Acercar red', 'Aumenta el nivel de zoom de la red visual.'],
    'ajustar-red': ['Ajustar red', 'Centra y ajusta toda la red dentro del área visible.'],
    animacion: ['Animación de la red', 'Activa o pausa el movimiento automático de los nodos.'],
  },
  structure: {
    'cerrar-historial': ['Cerrar historial', 'Cierra el historial de versiones de la estructura.'],
    'descartar-importacion': ['Descartar importación', 'Descarta las secciones detectadas sin guardar una versión.'],
    'cancelar-edicion': ['Cancelar edición', 'Descarta los cambios de la nueva versión en preparación.'],
    'cancelar-restauracion': ['Cancelar restauración', 'Cierra la confirmación sin restaurar la versión.'],
  },
  report: {
    'seleccionar-seccion': ['Seleccionar sección del informe', 'Cambia la sección oficial que estás redactando. Los botones repetidos cumplen la misma función.'],
    'seleccionar-regla-ia': ['Seleccionar regla de IA', 'Abre una regla de generación para revisar o modificar su configuración.'],
    negrita: ['Negrita', 'Aplica o quita negrita al texto seleccionado.'],
    cursiva: ['Cursiva', 'Aplica o quita cursiva al texto seleccionado.'],
    subrayado: ['Subrayado', 'Aplica o quita subrayado al texto seleccionado.'],
    'lista-vinetas': ['Lista con viñetas', 'Convierte el texto seleccionado en una lista con viñetas.'],
    'lista-numerada': ['Lista numerada', 'Convierte el texto seleccionado en una lista numerada.'],
    cita: ['Cita', 'Da formato de cita al párrafo seleccionado.'],
    deshacer: ['Deshacer', 'Revierte el cambio más reciente del borrador.'],
    rehacer: ['Rehacer', 'Vuelve a aplicar el último cambio deshecho.'],
    'guardar-ahora': ['Guardar ahora', 'Guarda inmediatamente los cambios pendientes del borrador.'],
    'cerrar-coincidencias': ['Cerrar coincidencias', 'Cierra el panel de evidencias relacionadas con el texto.'],
    'descartar-insercion': ['Descartar inserción', 'Cierra la confirmación sin insertar el contenido.'],
    'confirmar-insercion': ['Confirmar inserción', 'Inserta en el borrador la evidencia seleccionada.'],
    'revisar-fuentes': ['Revisar fuentes', 'Muestra las evidencias usadas para generar la propuesta.'],
    'descartar-vista-previa': ['Descartar vista previa', 'Cierra la propuesta generada sin insertarla.'],
    'insertar-vista-previa': ['Insertar vista previa', 'Incorpora la propuesta generada a la sección activa del informe.'],
  },
  cloud: {
    'google-drive': ['Google Drive', 'Selecciona Google Drive como proveedor de almacenamiento.'],
    dropbox: ['Dropbox', 'Selecciona Dropbox como proveedor de almacenamiento.'],
    'cargar-desde-equipo': ['Cargar desde mi equipo', 'Abre la carga local cuando el archivo no está en la nube.'],
    'abrir-carpeta': ['Abrir carpeta', 'Entra a una carpeta del almacenamiento conectado.'],
    'restaurar-existente': ['Restaurar existente', 'Recupera desde la papelera el documento que ya existía.'],
    reemplazar: ['Reemplazar documento', 'Sustituye el documento existente por el archivo importado.'],
    'conservar-ambos': ['Conservar ambos', 'Mantiene el documento existente y el nuevo archivo importado.'],
    'cancelar-duplicado': ['Cancelar importación', 'Cierra la resolución de duplicado sin importar el archivo.'],
  },
  trash: {
    'confirmar-eliminacion': ['Confirmar eliminación', 'Elimina definitivamente el documento seleccionado.'],
    'cancelar-eliminacion': ['Cancelar eliminación', 'Conserva el documento en la papelera.'],
    reintentar: ['Reintentar carga', 'Vuelve a solicitar los documentos de la papelera.'],
  },
  'security-events': {
    'pagina-anterior': ['Página anterior', 'Muestra la página anterior del registro de seguridad.'],
    'ir-pagina': ['Ir a página', 'Abre la página seleccionada del registro.'],
    'pagina-siguiente': ['Página siguiente', 'Muestra la página siguiente del registro de seguridad.'],
    reintentar: ['Reintentar carga', 'Vuelve a solicitar el registro de seguridad.'],
  },
  team: {
    'cancelar-eliminacion': ['Cancelar eliminación', 'Cierra la confirmación y conserva el acceso del integrante.'],
  },
};

export function onboardingSectionForPath(pathname) {
  return SECTION_BY_PATH.find(([pattern]) => pattern.test(pathname))?.[1] ?? null;
}

export function onboardingDescriptionForStepId(stepId) {
  const match = /^ui:([a-z0-9-]+):([a-z0-9-]+)$/.exec(String(stepId || ''));
  if (!match) return null;
  const [, section, key] = match;
  if (key === 'intro') return SECTION_INTROS[section] ?? null;
  return EXTRA_DESCRIPTIONS[section]?.[key] ?? SECTION_DESCRIPTIONS[section]?.[key] ?? null;
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function elementLabel(element) {
  const associatedLabel = element.labels?.[0]?.textContent;
  return normalizeWhitespace(
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    associatedLabel ||
    element.innerText ||
    element.textContent ||
    '',
  );
}

function normalized(value) {
  return normalizeWhitespace(value).toLocaleLowerCase('es-CL');
}

function extraMatchingKey(section, element, label) {
  const text = normalized(label);

  if (element.matches('select')) {
    if ((section === 'app' || section === 'milestones') && text.startsWith('responsable')) {
      return 'responsable-hito';
    }
    if (section === 'documents' && text.startsWith('ordenar')) return 'ordenar';
    if (section === 'document-detail' && text.includes('subcriterio')) return 'seleccionar-subcriterio';
    if (section === 'search' && text.includes('temática')) return 'seleccionar-tematica-red';
    if (section === 'report' && text.includes('estilo de párrafo')) return 'estilo-parrafo';
    if (section === 'cloud' && text.includes('tipo de archivo')) return 'filtrar-tipo-archivo';
    if (section === 'security-events' && text.startsWith('filas por página')) return 'filas-por-pagina';
    if (section === 'team') {
      return text.includes('rol a asignar') ? 'rol-integrante' : 'nivel-permiso';
    }
  }

  if (section === 'app' || section === 'milestones') {
    if (text.includes('en plazo')) return 'filtro-en-plazo';
    if (text.includes('por vencer')) return 'filtro-por-vencer';
    if (text.includes('vencido')) return 'filtro-vencidos';
    if (text.includes('completado') && !text.includes('marcar')) return 'filtro-completados';
    if (text === 'ver todos') return 'ver-todos';
    if (text === 'guardar cambios' || text === 'guardando…' || (text === 'registrar hito' && element.closest('form'))) return 'guardar-hito';
    if (text === 'cancelar edición') return 'cancelar-edicion';
    if (text.includes('cerrar hitos') || text === 'cerrar') return 'cerrar-hitos';
    if (text === 'reintentar') return 'reintentar';
  }

  if (section === 'documents') {
    if (text === 'buscar') return 'buscar';
    if (text === 'todos los archivos') return 'todos';
    if (text === 'filtrar') return 'filtros';
    if (text === 'repositorio' || text.startsWith('abrir ')) return 'abrir-carpeta';
    if (text.startsWith('acciones para') || text === '⋮') return 'acciones-elemento';
    if (text === 'guardar') return 'guardar-renombre';
    if (text === '×') return 'cancelar-renombre';
    if (text === 'cancelar' && element.closest('[role="dialog"], dialog')) {
      return element.closest('[data-delete-folder-dialog]')
        ? 'cancelar-eliminar-carpeta'
        : 'cancelar-crear-carpeta';
    }
    if (text === 'eliminar') return 'eliminar-elemento';
    if (text.includes('eliminar solo la agrupación')) return 'eliminar-solo-carpeta';
    if (text.includes('eliminar carpeta') && text.includes('archivos')) return 'eliminar-carpeta-con-archivos';
    if (text === 'deseleccionar') return 'deseleccionar';
    if (text === 'entendido') return 'cerrar-mensaje';
    if (text === 'reintentar') return 'reintentar';
  }

  if (section === 'document-detail') {
    if (text.includes('ver archivo')) return 'ver-archivo';
    if (text.includes('clasificación de respaldo') || text.includes('usar método de respaldo')) return 'clasificacion-respaldo';
    if (text.includes('papelera')) return 'mover-a-papelera';
  }

  if (section === 'search') {
    if (text.includes('cerrar nueva temática')) return 'cerrar-tematica';
    if (text === 'cancelar') return 'cancelar-tematica';
    if (text.includes('guardar temática') || text === 'agregar temática' || text === 'guardando…') return 'guardar-tematica';
    if (text.includes('actualizar red')) return 'actualizar-red';
    if (text.includes('reintentar')) return 'reintentar-red';
    if (text === 'ver todos') return 'ver-todos';
    if (text.startsWith('documento:') || text.startsWith('abrir documento')) return 'abrir-documento';
    if (text === 'alejar') return 'alejar';
    if (text === 'acercar') return 'acercar';
    if (text === 'ajustar red') return 'ajustar-red';
    if (text === 'animación de la red' || text === 'animación') return 'animacion';
  }

  if (section === 'structure') {
    if (text.includes('cerrar historial')) return 'cerrar-historial';
    if (text.includes('descartar')) return 'descartar-importacion';
    if (text.includes('cancelar edición') || (text === 'cancelar' && element.closest('[data-structure-editor]'))) return 'cancelar-edicion';
    if (text === 'cancelar' && element.closest('[data-restore-dialog]')) return 'cancelar-restauracion';
  }

  if (section === 'report') {
    const toolbarKeys = {
      negrita: 'negrita', cursiva: 'cursiva', subrayado: 'subrayado',
      'lista con viñetas': 'lista-vinetas', 'lista numerada': 'lista-numerada',
      cita: 'cita', deshacer: 'deshacer', rehacer: 'rehacer',
    };
    if (toolbarKeys[text]) return toolbarKeys[text];
    if (text === 'guardar ahora' || text === 'guardando…') return 'guardar-ahora';
    if (element.closest('[data-report-sections]')) return 'seleccionar-seccion';
    if (element.closest('[data-generation-sections]')) return 'seleccionar-regla-ia';
    if (text === 'descartar') {
      return element.closest('[data-preview-dialog]')
        ? 'descartar-vista-previa'
        : 'descartar-insercion';
    }
    if (text === 'insertar en el editor') return 'confirmar-insercion';
    if (text === 'insertar en el editor principal') return 'insertar-vista-previa';
    if (text.includes('buscar incoherencias entre los documentos usados')) return 'revisar-fuentes';
    if (text.includes('cerrar coincidencias') || (text === '✕' && element.closest('[data-matches-panel]'))) return 'cerrar-coincidencias';
  }

  if (section === 'cloud') {
    if (text === 'google drive') return 'google-drive';
    if (text === 'dropbox') return 'dropbox';
    if (text.includes('cargar desde mi equipo')) return 'cargar-desde-equipo';
    if (text.startsWith('📁')) return 'abrir-carpeta';
    if (text.includes('restaurar el existente')) return 'restaurar-existente';
    if (text === 'reemplazar') return 'reemplazar';
    if (text.includes('conservar ambos')) return 'conservar-ambos';
    if (text === 'cancelar' || text.includes('cancelar este archivo')) return 'cancelar-duplicado';
  }

  if (section === 'trash') {
    if (text === 'confirmar') return 'confirmar-eliminacion';
    if (text === 'cancelar') return 'cancelar-eliminacion';
    if (text === 'reintentar') return 'reintentar';
  }

  if (section === 'security-events') {
    if (text === '← anterior' || text === 'anterior') return 'pagina-anterior';
    if (text.startsWith('ir a la página') || /^\d+$/.test(text)) return 'ir-pagina';
    if (text === 'siguiente →' || text === 'siguiente') return 'pagina-siguiente';
    if (text === 'reintentar') return 'reintentar';
  }

  if (section === 'team' && text === 'cancelar') return 'cancelar-eliminacion';

  return null;
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
  return visible(element);
}

function firstMatchingKey(section, element, label) {
  const text = normalized(label);

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
    // La barra de formato, las secciones oficiales y las reglas IA ya fueron
    // agrupadas por función en extraMatchingKey para no repetir etapas.
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

    // Los botones con nombres variables ya fueron detectados por su contenedor.
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
    return null;
  }

  return null;
}

export function discoverOnboardingControls(pathname, root = document.querySelector('main')) {
  const section = onboardingSectionForPath(pathname);
  const descriptions = section
    ? {
        ...SECTION_DESCRIPTIONS[section],
        ...EXTRA_DESCRIPTIONS[section],
        intro: SECTION_INTROS[section],
      }
    : null;

  if (!section || !descriptions || !root) return [];

  const byFunction = new Map();
  const heading = Array.from(root.querySelectorAll('h1, h2')).find(visible);

  if (heading && descriptions.intro) {
    const [title, description] = descriptions.intro;
    const id = `ui:${section}:intro`;
    heading.setAttribute('data-onboarding-step-id', id);
    byFunction.set('intro', {
      id,
      section,
      key: 'intro',
      title,
      description,
      element: heading,
    });
  }

  const candidates = Array.from(
    root.querySelectorAll('button, [role="button"], a[href], select'),
  ).filter(available);

  for (const element of candidates) {
    const label = elementLabel(element);
    const key = extraMatchingKey(section, element, label) || firstMatchingKey(section, element, label);

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
