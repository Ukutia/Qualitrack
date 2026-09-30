// Análisis en curso que el usuario lanzó y de los que espera aviso al terminar.
//
// Vive en localStorage para que el seguimiento sobreviva a cambiar de sección,
// recargar o cerrar la pestaña: el vigilante global (AnalysisWatcher) retoma la
// lista al montar y avisa cuando cada documento termina.

const STORAGE_KEY = 'qualitrack_analisis_en_curso';

/** Evento de ventana que avisa al vigilante que la lista cambió. */
export const WATCH_EVENT = 'qualitrack:analisis-vigilados';

export function watchedAnalyses() {
  try {
    const ids = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(ids) ? ids.map(String) : [];
  } catch {
    return [];
  }
}

function save(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Sin almacenamiento el aviso sigue funcionando mientras la pestaña viva.
  }
  window.dispatchEvent(new Event(WATCH_EVENT));
}

export function watchAnalysis(id) {
  const ids = watchedAnalyses();
  if (!ids.includes(String(id))) save([...ids, String(id)]);

  // Se pide aquí y no al abrir la ficha: los navegadores solo muestran el
  // diálogo de permiso tras un gesto del usuario, como pulsar "Clasificar".
  if ('Notification' in window && Notification.permission === 'default') {
    Promise.resolve(Notification.requestPermission()).catch(() => {});
  }
}

export function unwatchAnalysis(id) {
  save(watchedAnalyses().filter((item) => item !== String(id)));
}
