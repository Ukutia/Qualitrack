import { useCallback, useEffect, useRef, useState } from 'react';
import DraftEditor from '../components/DraftEditor.jsx';
import {
  useReportDrafts,
  useReportDraft,
  useCreateReportDraft,
  useSaveReportDraft,
  useDeleteReportDraft,
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
                  {listFmt.format(new Date(item.updatedAt))}
                </p>
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                aria-label={`Eliminar ${item.title}`}
                className="btn absolute right-2 top-2 hidden rounded-md px-1.5 py-0.5 text-xs text-stone-400 hover:bg-rose-50 hover:text-rose-600 group-hover:block"
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

              <DraftEditor
                key={draft.data.id}
                initialHtml={draft.data.contentHtml}
                onChange={(html) => schedule({ contentHtml: html })}
              />

              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <SaveIndicator status={status} savedAt={savedAt} />
                <button
                  onClick={flush}
                  disabled={status === 'saving' || !pendingRef.current}
                  className="btn rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-stone-600 ring-1 ring-stone-900/10 hover:text-ink-900 disabled:opacity-50"
                >
                  Guardar ahora
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
