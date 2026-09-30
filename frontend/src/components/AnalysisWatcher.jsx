import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { normalizeAnalysisStatus } from '../lib/analysisStatus.js';
import { WATCH_EVENT, unwatchAnalysis, watchedAnalyses } from '../lib/analysisWatch.js';

const TOAST_MS = 12000;
// Espera antes de reabrir un stream que se cerró sin que el documento
// desapareciera (backend reiniciándose, corte de red).
const RETRY_MS = 5000;

/**
 * Sigue los análisis lanzados por el usuario en cualquier sección de la app y
 * avisa cuando terminan. Antes el aviso vivía en la ficha del documento, así
 * que al navegar a otra sección se cerraba la conexión y el análisis terminaba
 * sin que nadie se enterara.
 */
export default function AnalysisWatcher() {
  const qc = useQueryClient();
  const [ids, setIds] = useState(watchedAnalyses);
  const [toasts, setToasts] = useState([]);
  const sources = useRef(new Map());

  const dismiss = useCallback((key) => {
    setToasts((list) => list.filter((toast) => toast.key !== key));
  }, []);

  const notify = useCallback((toast) => {
    const key = `${toast.id}-${Date.now()}`;
    setToasts((list) => [...list, { ...toast, key }]);
    setTimeout(() => dismiss(key), TOAST_MS);

    // Con la pestaña del navegador oculta el aviso en pantalla no se ve;
    // ahí se recurre a la notificación del sistema, si hay permiso.
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(toast.title, { body: toast.body, tag: `analisis-${toast.id}` });
      n.onclick = () => window.focus();
    }
  }, [dismiss]);

  useEffect(() => {
    const sync = () => setIds(watchedAnalyses());
    window.addEventListener(WATCH_EVENT, sync);
    // Otras pestañas de la app comparten la lista.
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(WATCH_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('qualitrack_token') || '';

    for (const id of ids) {
      if (sources.current.has(id)) continue;

      const url = `${api.defaults.baseURL || '/api'}/documents/${id}/stream?token=${encodeURIComponent(token)}`;
      const source = new EventSource(url);

      source.addEventListener('document-status', (event) => {
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }

        const status = normalizeAnalysisStatus(payload.analysisStatus);
        if (status !== 'COMPLETED' && status !== 'ERROR') return;

        unwatchAnalysis(id);
        // La ficha no se toca: si está abierta la actualiza su propio stream
        // (recargarla aquí se adelantaba a la cola de etapas), y si no, se
        // vuelve a pedir al abrirla.
        qc.invalidateQueries({ queryKey: ['documents'] });

        const name = payload.name || `Documento ${id}`;
        notify(
          status === 'COMPLETED'
            ? { id, ok: true, title: 'Análisis completado', body: `${name}: la propuesta ya está lista.` }
            : { id, ok: false, title: 'El análisis falló', body: `${name}: ${payload.analysisError || 'error desconocido.'}` }
        );
      });

      source.onerror = () => {
        // EventSource reintenta solo ante cortes de red. Si queda CLOSED puede
        // ser que el documento ya no exista (403/404), pero también que la
        // página se esté recargando: el navegador cierra los streams al salir.
        // Descartar ahí borraba el análisis de la lista justo antes de que la
        // página nueva lo retomara, así que se confirma con la API.
        if (source.readyState !== EventSource.CLOSED) return;
        sources.current.delete(id);
        api.get(`/documents/${id}`)
          .then(() => setTimeout(() => setIds(watchedAnalyses()), RETRY_MS))
          .catch((error) => {
            if ([403, 404, 410].includes(error?.response?.status)) unwatchAnalysis(id);
            else setTimeout(() => setIds(watchedAnalyses()), RETRY_MS);
          });
      };

      sources.current.set(id, source);
    }

    for (const [id, source] of sources.current) {
      if (!ids.includes(id)) {
        source.close();
        sources.current.delete(id);
      }
    }
  }, [ids, qc, notify]);

  useEffect(() => {
    const open = sources.current;
    return () => {
      for (const source of open.values()) source.close();
      open.clear();
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.key}
          className={`pointer-events-auto rounded-xl border-l-4 bg-white p-4 shadow-lg ring-1 ring-stone-200 ${
            toast.ok ? 'border-emerald-500' : 'border-rose-500'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${toast.ok ? 'text-emerald-800' : 'text-rose-700'}`}>{toast.title}</p>
              <p className="mt-1 break-words text-sm text-steel-600">{toast.body}</p>
              <Link
                to={`/documents/${toast.id}`}
                onClick={() => dismiss(toast.key)}
                className="mt-2 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                {toast.ok ? 'Ver propuesta →' : 'Ver documento →'}
              </Link>
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.key)}
              aria-label="Cerrar aviso"
              className="text-steel-400 hover:text-steel-600"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
