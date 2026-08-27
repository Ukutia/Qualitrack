import { useCallback, useEffect, useRef, useState } from 'react';
import DraftEditor from '../components/DraftEditor.jsx';
import {
  useReportDrafts,
  useReportDraft,
  useCreateReportDraft,
  useSaveReportDraft,
  useDeleteReportDraft,
  useReportDraftHistory,
  useRestoreReportDraft,
} from '../hooks/useApi.js';

// Autoguardado: el criterio exige "como máximo 5 segundos después de la última
// modificación"; se deja holgura para la latencia de red.
const AUTOSAVE_MS = 2000;
const RETRY_MS = 5000;
const LAST_DRAFT_KEY = 'qualitrack_last_draft';

const timeFmt = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const listFmt = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const STATUS_STYLE = {
  saving: 'bg-brand-50 text-brand-800 ring-brand-600/20',
  saved: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  dirty: 'bg-amber-50 text-amber-900 ring-amber-600/20',
  error: 'bg-rose-50 text-rose-800 ring-rose-600/20',
};

// Panel de coincidencias: se abre al presionar "Buscar coincidencias" sobre un
// fragmento seleccionado del borrador. Placeholder a la espera de conectar la
// búsqueda real de coincidencias en los documentos cargados.
function MatchesPanel({ query, onClose }) {
  return (
    <aside className="w-80 shrink-0 space-y-3 rounded-2xl bg-white p-5 ring-1 ring-stone-900/10 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-stone-500">
          Coincidencias
        </p>
        <button
          onClick={onClose}
          aria-label="Cerrar panel de coincidencias"
          className="btn -mr-1 -mt-1 rounded-md px-1.5 py-0.5 text-xs text-stone-400 hover:bg-stone-100 hover:text-stone-700"
        >
          ✕
        </button>
      </div>

      <blockquote className="rounded-lg border-l-4 border-brand-200 bg-brand-50/50 px-3 py-2 text-xs italic text-stone-600">
        “{query}”
      </blockquote>

      <div className="rounded-xl bg-stone-50 px-4 py-6 text-center ring-1 ring-stone-900/10">
        <p className="text-sm font-medium text-ink-900">Búsqueda no disponible todavía</p>
        <p className="mt-1 text-xs text-stone-500">
          Aquí se listarán los documentos con coincidencias para el fragmento seleccionado
          cuando la funcionalidad esté lista.
        </p>
      </div>
    </aside>
  );
}

function SaveIndicator({ status, savedAt }) {
  const hora = savedAt ? timeFmt.format(new Date(savedAt)) : null;

  const text =
    status === 'saving'
      ? 'Guardando…'
      : status === 'error'
        ? 'No se pudo guardar — reintentando'
        : status === 'dirty'
          ? 'Cambios sin guardar'
          : hora
            ? `Guardado a las ${hora}`
            : 'Sin cambios todavía';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${
          STATUS_STYLE[status] ?? 'bg-stone-100 text-stone-600 ring-stone-900/10'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            status === 'saving'
              ? 'animate-pulse bg-brand-600'
              : status === 'error'
                ? 'bg-rose-600'
                : status === 'dirty'
                  ? 'bg-amber-500'
                  : 'bg-emerald-600'
          }`}
        />
        {text}
      </span>
      {hora && status !== 'saved' && status !== 'idle' && (
        <span className="text-xs text-stone-500 tnum">Última versión almacenada: {hora}</span>
      )}
    </div>
  );
}

export default function ReportEditor() {
  const drafts = useReportDrafts();
  const [selectedId, setSelectedId] = useState(
    () => Number(localStorage.getItem(LAST_DRAFT_KEY)) || null
  );
  const draft = useReportDraft(selectedId);

  const createDraft = useCreateReportDraft();
  const saveDraft = useSaveReportDraft();
  const deleteDraft = useDeleteReportDraft();

  const [status, setStatus] = useState('idle');
  const [savedAt, setSavedAt] = useState(null);
  const [title, setTitle] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  // Fuerza el remontaje del editor tras una restauración: el contenido del
  // `contentEditable` solo se inyecta una vez por `id` (ver DraftEditor).
  const [restoreNonce, setRestoreNonce] = useState(0);
  const [matchesQuery, setMatchesQuery] = useState(null);

  const pendingRef = useRef(null);
  const timerRef = useRef(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  // Selecciona el borrador a abrir: el último usado si sigue existiendo, si no
  // el más reciente. Así "cerrar la sección y volver a ingresar" reabre lo mismo.
  useEffect(() => {
    if (!drafts.data) return;
    const exists = drafts.data.some((d) => d.id === selectedRef.current);
    if (!exists) setSelectedId(drafts.data[0]?.id ?? null);
  }, [drafts.data]);

  useEffect(() => {
    if (selectedId) localStorage.setItem(LAST_DRAFT_KEY, String(selectedId));
    else localStorage.removeItem(LAST_DRAFT_KEY);
  }, [selectedId]);

  // Al abrir otro borrador, el estado de guardado parte limpio con su fecha real.
  useEffect(() => {
    if (!draft.data) return;
    setTitle(draft.data.title);
    setSavedAt(draft.data.updatedAt);
    setStatus('idle');
    setMatchesQuery(null);
    pendingRef.current = null;
    clearTimeout(timerRef.current);
  }, [draft.data]);

  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    const patch = pendingRef.current;
    const id = selectedRef.current;
    if (!patch || !id) return;

    pendingRef.current = null;
    setStatus('saving');
    saveDraft.mutate(
      { id, ...patch },
      {
        onSuccess: (data) => {
          setSavedAt(data.updatedAt);
          setStatus(pendingRef.current ? 'dirty' : 'saved');
        },
        onError: () => {
          // Se reinstalan los cambios no guardados sin pisar lo escrito después.
          pendingRef.current = { ...patch, ...(pendingRef.current ?? {}) };
          setStatus('error');
          timerRef.current = setTimeout(flush, RETRY_MS);
        },
      }
    );
  }, [saveDraft]);

  const flushRef = useRef(flush);
  flushRef.current = flush;

  const schedule = useCallback((patch) => {
    pendingRef.current = { ...(pendingRef.current ?? {}), ...patch };
    setStatus('dirty');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flushRef.current(), AUTOSAVE_MS);
  }, []);

  // Salir de la sección no debe perder lo escrito en los últimos segundos.
  useEffect(() => {
    function warn(event) {
      if (!pendingRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      clearTimeout(timerRef.current);
      flushRef.current();
    };
  }, []);

  function handleSelect(id) {
    if (id === selectedId) return;
    flush();
    setSelectedId(id);
  }

  async function handleNew() {
    flush();
    const created = await createDraft.mutateAsync({});
    setSelectedId(created.id);
  }

  // Exporta el borrador a PDF vía el diálogo de impresión del navegador. Se
  // usa un iframe oculto en vez de `window.open`: los bloqueadores de
  // ventanas emergentes interceptan la segunda opción en varios navegadores.
  function handleExport() {
    const safeTitle = (title || 'Borrador sin título').replace(/[<>]/g, '');

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    iframe.contentDocument.write(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>
  body {
    font-family: Georgia, Cambria, serif;
    color: #1c1e26;
    max-width: 46rem;
    margin: 2.5rem auto;
    padding: 0 1.5rem;
    line-height: 1.6;
  }
  h1.doc-title {
    font-size: 1.9rem;
    font-weight: 600;
    margin-bottom: 1.75rem;
  }
  h1, h2, h3 { font-weight: 500; line-height: 1.25; }
  h1 { font-size: 1.6rem; }
  h2 { font-size: 1.3rem; }
  h3 { font-size: 1.1rem; }
  ul, ol { padding-left: 1.5rem; }
  blockquote {
    border-left: 3px solid #b78c4a;
    padding-left: 0.9rem;
    color: #454545;
    font-style: italic;
    margin-left: 0;
  }
  @media print {
    body { margin: 0; padding: 1.5rem; }
  }
</style>
</head>
<body>
<h1 class="doc-title">${safeTitle}</h1>
${draft.data?.contentHtml || ''}
</body>
</html>`);
    iframe.contentDocument.close();

    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este borrador? La acción no se puede deshacer.')) return;
    clearTimeout(timerRef.current);
    pendingRef.current = null;
    await deleteDraft.mutateAsync(id);
    if (id === selectedId) setSelectedId(null);
  }

  const list = drafts.data ?? [];

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink-900">
            Redacción del informe
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Redacte el borrador dentro de la plataforma. Los cambios se guardan solos.
          </p>
        </div>
        <button
          onClick={handleNew}
          disabled={createDraft.isPending}
          className="btn rounded-xl bg-ink-800 px-4 py-2.5 text-sm font-medium text-stone-50 shadow-sm hover:bg-ink-700 disabled:opacity-60"
        >
          {createDraft.isPending ? 'Creando…' : 'Nuevo borrador'}
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="space-y-2">
          <p className="px-1 text-[10px] font-medium uppercase tracking-[0.22em] text-stone-500">
            Borradores
          </p>

          {drafts.isLoading && (
            <>
              <div className="skeleton h-16" />
              <div className="skeleton h-16" />
            </>
          )}

          {!drafts.isLoading && list.length === 0 && (
            <p className="rounded-xl bg-white/60 px-4 py-5 text-sm text-stone-500 ring-1 ring-stone-900/10">
              Aún no hay borradores. Cree el primero para empezar a redactar.
            </p>
          )}

          {list.map((item) => (
            <div
              key={item.id}
              className={`group relative rounded-xl ring-1 transition-colors ${
                item.id === selectedId
                  ? 'bg-white ring-ink-800/25 shadow-sm'
                  : 'bg-white/50 ring-stone-900/10 hover:bg-white'
              }`}
            >
              <button
                onClick={() => handleSelect(item.id)}
                className="block w-full px-4 py-3 text-left"
              >
                <p className="truncate text-sm font-medium text-ink-900">{item.title}</p>
                <p className="mt-0.5 truncate text-xs text-stone-500">
                  {item.preview || 'Sin contenido'}
                </p>
                <p className="mt-1 text-[11px] text-stone-400 tnum">
                  Creado el {listFmt.format(new Date(item.createdAt))}
                </p>
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                aria-label={`Eliminar ${item.title}`}
                className="btn absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-xs text-stone-400 opacity-40 hover:bg-rose-50 hover:text-rose-600 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </aside>

        <section className="space-y-3">
          {!selectedId && !drafts.isLoading && (
            <div className="rounded-2xl bg-white px-8 py-16 text-center ring-1 ring-stone-900/10">
              <p className="font-display text-lg text-ink-900">Ningún borrador abierto</p>
              <p className="mt-1 text-sm text-stone-500">
                Cree un borrador nuevo o seleccione uno de la lista.
              </p>
            </div>
          )}

          {selectedId && draft.isLoading && (
            <>
              <div className="skeleton h-11" />
              <div className="skeleton h-[26rem]" />
            </>
          )}

          {selectedId && draft.isError && (
            <p className="alert-in rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-600/20">
              No se pudo cargar el borrador.
            </p>
          )}

          {draft.data && (
            <>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  schedule({ title: e.target.value });
                }}
                onBlur={flush}
                aria-label="Título del borrador"
                placeholder="Título del borrador"
                className="w-full rounded-xl bg-white px-5 py-3 font-display text-lg font-semibold text-ink-900 ring-1 ring-stone-900/10 focus:ring-ink-800/30"
              />

              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1 space-y-3">
                  <DraftEditor
                    key={`${draft.data.id}:${restoreNonce}`}
                    initialHtml={draft.data.contentHtml}
                    onChange={(html) => schedule({ contentHtml: html })}
                    onOpenMatches={(text) => setMatchesQuery(text)}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                    <SaveIndicator status={status} savedAt={savedAt} />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setHistoryOpen((v) => !v)}
                        className="btn rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-stone-600 ring-1 ring-stone-900/10 hover:text-ink-900"
                      >
                        {historyOpen ? 'Ocultar historial' : 'Historial de versiones'}
                      </button>
                      <button
                        onClick={handleExport}
                        className="btn rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-stone-600 ring-1 ring-stone-900/10 hover:text-ink-900"
                      >
                        Exportar a PDF
                      </button>
                      <button
                        onClick={flush}
                        disabled={status === 'saving' || !pendingRef.current}
                        className="btn rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-stone-600 ring-1 ring-stone-900/10 hover:text-ink-900 disabled:opacity-50"
                      >
                        Guardar ahora
                      </button>
                    </div>
                  </div>

                  {historyOpen && (
                    <DraftHistory
                      draftId={draft.data.id}
                      onRestored={(restored) => {
                        setTitle(restored.title);
                        setSavedAt(restored.updatedAt);
                        setStatus('idle');
                        pendingRef.current = null;
                        clearTimeout(timerRef.current);
                        setRestoreNonce((n) => n + 1);
                      }}
                    />
                  )}
                </div>

                {matchesQuery !== null && (
                  <MatchesPanel query={matchesQuery} onClose={() => setMatchesQuery(null)} />
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function DraftHistory({ draftId, onRestored }) {
  const history = useReportDraftHistory(draftId);
  const restoreDraft = useRestoreReportDraft();

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-900/10">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-stone-500">
        Historial de versiones
      </p>

      {history.isLoading && <div className="skeleton h-10" />}

      {history.data && history.data.length === 0 && (
        <p className="text-sm text-stone-500">
          Aún no hay instantáneas guardadas. Se crean automáticamente al redactar.
        </p>
      )}

      <ul className="divide-y divide-stone-900/5">
        {(history.data ?? []).map((v) => (
          <li key={v.version} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-900">{v.title}</p>
              <p className="truncate text-xs text-stone-500">{v.preview || 'Sin contenido'}</p>
              <p className="mt-0.5 text-[11px] text-stone-400 tnum">
                Versión {v.version} · {listFmt.format(new Date(v.createdAt))}
                {v.createdBy ? ` · ${v.createdBy.name}` : ''}
              </p>
            </div>
            <button
              onClick={() => {
                if (!window.confirm(`¿Restaurar la versión ${v.version}? Se reemplazará el contenido actual.`))
                  return;
                restoreDraft.mutate(
                  { id: draftId, version: v.version },
                  { onSuccess: onRestored }
                );
              }}
              disabled={restoreDraft.isPending}
              className="btn shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-stone-600 ring-1 ring-stone-900/10 hover:text-ink-900 disabled:opacity-50"
            >
              Restaurar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
