import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DraftEditor from '../components/DraftEditor.jsx';
import {
  useReportDrafts,
  useReportDraft,
  useReportStructure,
  useReportDraftSections,
  useGenerationSections,
  useCreateGenerationSection,
  useUpdateGenerationSection,
  useDeleteGenerationSection,
  useImportGenerationSections,
  useDocuments,
  useCreateReportDraft,
  useSaveReportDraft,
  useSaveReportDraftSection,
  useReportDraftPreview,
  useReportDraftIncoherences,
  useDeleteReportDraft,
  useReportDraftHistory,
  useRestoreReportDraft,
  useSemanticSearch,
} from '../hooks/useApi.js';

const AUTOSAVE_MS = 2000;
const RETRY_MS = 5000;
const LAST_DRAFT_KEY = 'qualitrack_last_draft';

const timeFmt = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});
const listFmt = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
});

const STATUS_STYLE = {
  saving: 'bg-brand-50 text-brand-800 ring-brand-600/20',
  saved: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  dirty: 'bg-amber-50 text-amber-900 ring-amber-600/20',
  error: 'bg-rose-50 text-rose-800 ring-rose-600/20',
};

const MIN_SELECTION_WORDS = 4;
const MAX_SELECTION_WORDS = 100;
const MIN_MATCH_SIMILARITY = 0.50;
const MAX_PREVIEW_WORDS = 150;

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hasPending(ref) {
  return Object.keys(ref.current).length > 0;
}

function SaveIndicator({ status, savedAt }) {
  const hora = savedAt ? timeFmt.format(new Date(savedAt)) : null;
  const text =
    status === 'saving' ? 'Guardando…'
      : status === 'error' ? 'No se pudo guardar — reintentando'
      : status === 'dirty' ? 'Cambios sin guardar'
      : hora ? `Guardado a las ${hora}`
      : 'Sin cambios todavía';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span role="status" aria-live="polite" className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${STATUS_STYLE[status] ?? 'bg-stone-100 text-stone-600 ring-stone-900/10'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${status === 'saving' ? 'animate-pulse bg-brand-600' : status === 'error' ? 'bg-rose-600' : status === 'dirty' ? 'bg-amber-500' : 'bg-emerald-600'}`} />
        {text}
      </span>
      {hora && status !== 'saved' && status !== 'idle' && (
        <span className="text-xs text-stone-500 tnum">Última versión almacenada: {hora}</span>
      )}
    </div>
  );
}

function MatchesPanel({ query, search, elapsedMs, onClose, onRequestInsertEvidence }) {
  const results = (search.data?.results ?? []).filter((r) => r.similarity >= MIN_MATCH_SIMILARITY);
  const groupedMap = new Map();
  for (const result of results) {
    if (!groupedMap.has(result.documentId)) {
      groupedMap.set(result.documentId, { documentId: result.documentId, originalName: result.originalName, bestSimilarity: result.similarity, subcriterionCode: result.subcriterionCode, subcriterionName: result.subcriterionName, fragments: [] });
    }
    const document = groupedMap.get(result.documentId);
    document.bestSimilarity = Math.max(document.bestSimilarity, result.similarity);
    document.fragments.push({ chunkIndex: result.chunkIndex, content: result.content, similarity: result.similarity });
  }
  const documents = Array.from(groupedMap.values()).sort((a, b) => b.bestSimilarity - a.bestSimilarity);

  return (
    <aside className="w-80 shrink-0 rounded-2xl bg-white p-4 ring-1 ring-stone-900/10 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-stone-500">Coincidencias</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-ink-900">Documentos relacionados</h3>
        </div>
        <button type="button" onClick={onClose} className="btn rounded-lg px-2 py-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700">✕</button>
      </div>
      <blockquote className="mt-4 rounded-lg bg-stone-50 p-3 text-xs leading-5 text-stone-600 ring-1 ring-stone-900/5">“{query}”</blockquote>
      {elapsedMs !== null && elapsedMs !== undefined && <p className={`mt-2 text-xs ${elapsedMs < 1000 ? 'text-emerald-600' : 'text-rose-600'}`}>Procesado en {(elapsedMs / 1000).toFixed(2)} s</p>}
      {search.isPending && <div className="mt-4 space-y-2"><div className="skeleton h-20" /><p className="text-center text-xs text-stone-500">Buscando contenido relacionado…</p></div>}
      {search.isError && <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 ring-1 ring-rose-600/20">Error en el repositorio.</div>}
      {search.data && !search.isPending && documents.length === 0 && <div className="mt-4 rounded-lg bg-stone-50 p-4 text-center"><p className="text-sm font-medium text-ink-900">No se hallaron coincidencias</p></div>}
      {documents.length > 0 && (
        <div className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {documents.map((document) => (
            <article key={document.documentId} className="rounded-xl border border-stone-900/10 bg-stone-50/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/documents/${document.documentId}`} className="block truncate text-sm font-medium text-brand-700 hover:underline">{document.originalName}</Link>
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-medium text-stone-600 ring-1 ring-stone-900/10">{(document.bestSimilarity * 100).toFixed(0)}%</span>
              </div>
              <div className="mt-3 space-y-2">
                {document.fragments.slice(0, 2).map((fragment) => (
                  <div key={`${document.documentId}-${fragment.chunkIndex}`} className="rounded-lg bg-white p-2.5 ring-1 ring-stone-900/5">
                    <p className="text-xs leading-5 text-stone-700">{fragment.content.length > 280 ? `${fragment.content.slice(0, 280)}…` : fragment.content}</p>
                    <button type="button" onClick={() => onRequestInsertEvidence?.(fragment.content)} className="btn mt-2 rounded-lg bg-ink-800 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-ink-700">Insertar evidencia</button>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </aside>
  );
}

export default function ReportEditor() {
  const drafts = useReportDrafts();
  const documents = useDocuments();
  const reportStructure = useReportStructure();
  const [selectedId, setSelectedId] = useState(() => Number(localStorage.getItem(LAST_DRAFT_KEY)) || null);

  const draft = useReportDraft(selectedId);
  const draftSections = useReportDraftSections(selectedId);
  const generationSections = useGenerationSections(selectedId);

  const createGenerationSection = useCreateGenerationSection();
  const updateGenerationSection = useUpdateGenerationSection();
  const deleteGenerationSection = useDeleteGenerationSection();
  const importGenerationSections = useImportGenerationSections();
  const saveSectionDraft = useSaveReportDraftSection();
  const generatePreview = useReportDraftPreview();
  const incoherenceSearch = useReportDraftIncoherences();
  const createDraft = useCreateReportDraft();
  const saveDraft = useSaveReportDraft();
  const deleteDraft = useDeleteReportDraft();

  const [status, setStatus] = useState('idle');
  const [savedAt, setSavedAt] = useState(null);
  const [title, setTitle] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [restoreNonce, setRestoreNonce] = useState(0);
  const [matchesQuery, setMatchesQuery] = useState(null);
  const [generationOpen, setGenerationOpen] = useState(false);

  const [localEditorHtml, setLocalEditorHtml] = useState('');
  const [loadedKey, setLoadedKey] = useState(null);

  const matchesSearch = useSemanticSearch();

  const [selectionWarning, setSelectionWarning] = useState(null);
  const [searchElapsedMs, setSearchElapsedMs] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [sectionStatus, setSectionStatus] = useState('idle');
  const [sectionSavedAt, setSectionSavedAt] = useState(null);
  const [insertionRequest, setInsertionRequest] = useState(null);
  const [pendingEvidence, setPendingEvidence] = useState(null);
  const [pendingKind, setPendingKind] = useState('evidence'); // 'evidence' | 'generated'
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [preview, setPreview] = useState(null);
  const [incoherences, setIncoherences] = useState(null);

  const [generationSectionId, setGenerationSectionId] = useState(null);
  const [generationDraft, setGenerationDraft] = useState({ name: '', description: '', instructions: '' });
  const generationFileRef = useRef(null);

  const pendingRef = useRef({});          // { [draftId]: { title?, contentHtml? } }
  const contentCacheRef = useRef({});     // último HTML escrito por editor (evita ver contenido viejo al cambiar de sección)
  const timerRef = useRef(null);
  const sectionPendingRef = useRef({});   // { 'draftId:sectionId': { draftId, sectionId, contentHtml } }
  const sectionTimerRef = useRef(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  const structureSections = reportStructure.data?.sections ?? [];
  const sectionMode = Boolean(selectedId && structureSections.length > 0 && (draftSections.data?.sections?.length ?? 0) > 0);

  const draftSectionList = draftSections.data?.sections ?? [];
  const activeSection = sectionMode
    ? (draftSectionList.find((section) => section.structureSectionId === selectedSectionId) ?? draftSectionList[0] ?? null)
    : null;
  const activeSectionId = activeSection?.structureSectionId ?? null;

  const generationSectionList = generationSections.data?.sections ?? [];
  const activeGenerationSection = generationSectionList.find((section) => section.id === generationSectionId) || generationSectionList[0] || null;

  const contentKey = `${selectedId}:${activeSectionId ?? 'draft'}`;
  const currentEditorKey = `${contentKey}:${restoreNonce}`;

  // 1. Limpieza de almacenamiento si el borrador es inválido
  useEffect(() => {
    if (draft.isError || draftSections.isError || generationSections.isError) {
      setSelectedId(null);
      localStorage.removeItem(LAST_DRAFT_KEY);
    }
  }, [draft.isError, draftSections.isError, generationSections.isError]);

  // 3. Control seguro para las secciones generadas por IA
  const generationSectionsLength = generationSectionList.length;

  useEffect(() => {
    if (generationSectionsLength === 0) {
      if (generationSectionId !== null) {
        setGenerationSectionId(null);
        setGenerationDraft({ name: '', description: '', instructions: '' });
      }
      return;
    }
    const active = generationSectionList.find((section) => section.id === generationSectionId) || generationSectionList[0];

    if (active && active.id !== generationSectionId) {
      setGenerationSectionId(active.id);
      setGenerationDraft({
        name: active.name,
        description: active.description || '',
        instructions: (active.requirements?.instructions || []).join('\n'),
      });
    }
  }, [generationSectionsLength, generationSectionId]);

  // 4. Carga del contenido del editor.
  //    El editor solo se monta cuando el HTML inicial ya corresponde a la
  //    sección (o borrador) activa; así nunca se muestra contenido de otra sección.
  useEffect(() => {
    if (loadedKey === currentEditorKey || !draft.data) return;
    const cached = contentCacheRef.current[contentKey];
    const html = cached ?? (activeSection ? activeSection.contentHtml : draft.data.contentHtml);
    setLocalEditorHtml(html || '');
    setLoadedKey(currentEditorKey);
  }, [currentEditorKey, loadedKey, contentKey, activeSection, draft.data]);

  // ───────────────────────── AUTOGUARDADO UNIFICADO ─────────────────────────
  // Un solo mecanismo para título/contenido general y para secciones oficiales:
  //  - los cambios pendientes viven en refs (mapas por borrador / sección),
  //  - los guardados se encadenan en una cola (nunca dos en paralelo),
  //  - flush() devuelve una promesa que se resuelve cuando terminó de guardar.
  const mutateRef = useRef({});
  mutateRef.current = { saveDraft: saveDraft.mutateAsync, saveSection: saveSectionDraft.mutateAsync };
  const draftQueueRef = useRef(Promise.resolve());
  const sectionQueueRef = useRef(Promise.resolve());
  const flushRef = useRef(null);
  const flushSectionRef = useRef(null);

  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    draftQueueRef.current = draftQueueRef.current.then(async () => {
      const batch = Object.entries(pendingRef.current);
      if (batch.length === 0) return;
      pendingRef.current = {};
      setStatus('saving');
      for (let i = 0; i < batch.length; i += 1) {
        const [id, changes] = batch[i];
        try {
          const data = await mutateRef.current.saveDraft({ id: Number(id), ...changes });
          setSavedAt(data?.updatedAt ?? new Date().toISOString());
        } catch {
          // Devuelve lo que falló a la cola sin pisar ediciones más recientes.
          for (const [key, value] of batch.slice(i)) {
            pendingRef.current[key] = { ...value, ...(pendingRef.current[key] ?? {}) };
          }
          setStatus('error');
          timerRef.current = setTimeout(() => flushRef.current?.(), RETRY_MS);
          return;
        }
      }
      if (hasPending(pendingRef)) {
        setStatus('dirty');
        timerRef.current = setTimeout(() => flushRef.current?.(), AUTOSAVE_MS);
      } else {
        setStatus('saved');
      }
    });
    return draftQueueRef.current;
  }, []);
  flushRef.current = flush;

  const flushSection = useCallback(() => {
    clearTimeout(sectionTimerRef.current);
    sectionQueueRef.current = sectionQueueRef.current.then(async () => {
      const batch = Object.entries(sectionPendingRef.current);
      if (batch.length === 0) return;
      sectionPendingRef.current = {};
      setSectionStatus('saving');
      for (let i = 0; i < batch.length; i += 1) {
        const [, patch] = batch[i];
        try {
          const data = await mutateRef.current.saveSection({ draftId: patch.draftId, sectionId: patch.sectionId, contentHtml: patch.contentHtml });
          setSectionSavedAt(data?.updatedAt ?? new Date().toISOString());
        } catch {
          for (const [key, value] of batch.slice(i)) {
            if (!(key in sectionPendingRef.current)) sectionPendingRef.current[key] = value;
          }
          setSectionStatus('error');
          sectionTimerRef.current = setTimeout(() => flushSectionRef.current?.(), RETRY_MS);
          return;
        }
      }
      if (hasPending(sectionPendingRef)) {
        setSectionStatus('dirty');
        sectionTimerRef.current = setTimeout(() => flushSectionRef.current?.(), AUTOSAVE_MS);
      } else {
        setSectionStatus('saved');
      }
    });
    return sectionQueueRef.current;
  }, []);
  flushSectionRef.current = flushSection;

  const flushAll = useCallback(() => Promise.all([flush(), flushSection()]), [flush, flushSection]);

  const schedule = useCallback((changes, id = selectedRef.current) => {
    if (!id) return;
    pendingRef.current[id] = { ...(pendingRef.current[id] ?? {}), ...changes };
    setStatus('dirty');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flushRef.current?.(), AUTOSAVE_MS);
  }, []);

  const scheduleSection = useCallback((draftId, sectionId, contentHtml) => {
    sectionPendingRef.current[`${draftId}:${sectionId}`] = { draftId, sectionId, contentHtml };
    setSectionStatus('dirty');
    clearTimeout(sectionTimerRef.current);
    sectionTimerRef.current = setTimeout(() => flushSectionRef.current?.(), AUTOSAVE_MS);
  }, []);

  // Único punto de entrada de cambios del editor: decide el destino según lo que
  // el editor está mostrando (sección oficial o borrador general), no según el
  // panel de generación (que solo es configuración y no cambia qué se edita).
  function handleEditorChange(html) {
    contentCacheRef.current[contentKey] = html;
    if (activeSectionId) scheduleSection(selectedId, activeSectionId, html);
    else schedule({ contentHtml: html }, selectedId);
  }

  useEffect(() => {
    function warn(event) {
      if (!hasPending(pendingRef) && !hasPending(sectionPendingRef)) return;
      event.preventDefault(); event.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      flushRef.current?.(); flushSectionRef.current?.();
    };
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!drafts.data) return;
    const exists = drafts.data.some((d) => d.id === selectedRef.current);
    if (!exists) setSelectedId(drafts.data[0]?.id ?? null);
  }, [drafts.data]);

  useEffect(() => {
    if (selectedId) localStorage.setItem(LAST_DRAFT_KEY, String(selectedId));
    else localStorage.removeItem(LAST_DRAFT_KEY);
  }, [selectedId]);

  // Solo al CAMBIAR de borrador (no en cada refetch de draft.data). Antes este efecto
  // se ejecutaba tras cada guardado y borraba los cambios pendientes y el estado.
  const loadedDraftId = draft.data?.id ?? null;
  useEffect(() => {
    if (!draft.data) return;
    setTitle(draft.data.title); setSavedAt(draft.data.updatedAt); setStatus('idle');
    setSectionStatus('idle'); setSectionSavedAt(null);
    setMatchesQuery(null); setInsertionRequest(null); setPendingEvidence(null);
    setSelectedDocumentIds([]); setPreview(null); setIncoherences(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedDraftId]);

  async function handleOpenMatches(text) {
    const query = text.trim(); const wordCount = countWords(query);
    if (wordCount < MIN_SELECTION_WORDS) {
      matchesSearch.reset(); setMatchesQuery(null); setSearchElapsedMs(null); setSelectionWarning(`Seleccione al menos ${MIN_SELECTION_WORDS} palabras para disponer de contexto suficiente.`);
      return;
    }
    if (wordCount > MAX_SELECTION_WORDS) {
      matchesSearch.reset(); setMatchesQuery(null); setSearchElapsedMs(null); setSelectionWarning(`La selección no puede superar las ${MAX_SELECTION_WORDS} palabras.`);
      return;
    }
    setSelectionWarning(null); setMatchesQuery(query); setSearchElapsedMs(null); matchesSearch.reset();
    const start = performance.now();
    try { await matchesSearch.mutateAsync({ query, limit: 10 }); } finally { setSearchElapsedMs(Math.round(performance.now() - start)); }
  }

  function handleRequestInsertEvidence(text) {
    const evidence = text?.trim();
    if (!evidence) return;
    setPendingKind('evidence');
    setPendingEvidence(evidence);
  }

  function toggleDocument(id) {
    setSelectedDocumentIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 5) return current;
      return [...current, id];
    });
  }

  function handleGeneratePreview() {
    const targetSectionId = activeGenerationSection?.id;
    if (!selectedId || selectedDocumentIds.length < 1 || selectedDocumentIds.length > 5 || !targetSectionId) return;
    const documentIds = [...selectedDocumentIds].sort((a, b) => a - b);
    generatePreview.mutate(
      { draftId: selectedId, sectionId: targetSectionId, documentIds },
      { onSuccess: (result) => setPreview({ ...result, sectionId: targetSectionId, documentIds }) },
    );
  }

  async function handleCreateGenerationSection() {
    if (!selectedId) return;
    const created = await createGenerationSection.mutateAsync({ draftId: selectedId, name: 'Nueva sección', description: '', requirements: { minSources: 1, maxSources: 5, instructions: [] } });
    setGenerationSectionId(created.id);
    setGenerationDraft({ name: created.name || 'Nueva sección', description: '', instructions: '' });
  }

  async function handleSaveGenerationSection() {
    if (!selectedId || !activeGenerationSection || !generationDraft.name.trim()) return;
    await updateGenerationSection.mutateAsync({ draftId: selectedId, sectionId: activeGenerationSection.id, name: generationDraft.name, description: generationDraft.description, requirements: { minSources: 1, maxSources: 5, instructions: generationDraft.instructions.split('\n').map((line) => line.trim()).filter(Boolean) }, order: activeGenerationSection.order });
  }

  async function handleImportGenerationFile(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || !selectedId) return;
    await importGenerationSections.mutateAsync({ draftId: selectedId, file });
  }

  function handleDetectIncoherences() {
    if (!selectedId || selectedDocumentIds.length < 2) return;
    incoherenceSearch.mutate(
      { draftId: selectedId, documentIds: selectedDocumentIds },
      { onSuccess: (result) => setIncoherences(result) },
    );
  }

  function handleReviewPreviewSources() {
    setPreview(null);
    if (selectedDocumentIds.length >= 2) handleDetectIncoherences();
  }

  function handleInsertPreview() {
    const targetSectionId = activeGenerationSection?.id;
    if (!preview?.contentText || preview.sectionId !== targetSectionId) {
      setPreview(null); return;
    }
    setPendingKind('generated'); setPendingEvidence(preview.contentText); setPreview(null);
  }

  function handleConfirmInsertEvidence() {
    if (!pendingEvidence) return;
    setInsertionRequest({ id: Date.now(), text: pendingEvidence, kind: pendingKind }); setPendingEvidence(null); setMatchesQuery(null); matchesSearch.reset();
  }

  function handleSelect(id) {
    if (id === selectedId) return;
    flush(); flushSection(); setSelectedId(id);
  }

  async function handleNew() {
    flush(); flushSection();
    const created = await createDraft.mutateAsync({});
    setSelectedId(created.id);
  }

  async function handleExport(format) {
    await flushAll();
    const token = localStorage.getItem('qualitrack_token');
    const response = await fetch(`/api/report-drafts/${selectedId}/export/${format}`, { headers: { Authorization: `Bearer ${token || ''}` } });
    if (!response.ok) return;
    if (format === 'docx') {
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${title || 'borrador'}.docx`; anchor.click(); URL.revokeObjectURL(url); return;
    }
    const html = await response.text();
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
    document.body.appendChild(iframe); iframe.contentDocument.write(html); iframe.contentDocument.close(); iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 1000);
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este borrador? La acción no se puede deshacer.')) return;
    for (const key of Object.keys(sectionPendingRef.current)) if (key.startsWith(`${id}:`)) delete sectionPendingRef.current[key];
    delete pendingRef.current[id];
    await deleteDraft.mutateAsync(id);
    if (id === selectedId) setSelectedId(null);
  }

  const list = drafts.data ?? [];

  // Un solo indicador para ambos caminos de guardado (título/borrador y sección oficial).
  const statuses = [status, sectionStatus];
  const isSaving = statuses.includes('saving');
  const combinedStatus = isSaving ? 'saving'
    : statuses.includes('error') ? 'error'
    : statuses.includes('dirty') ? 'dirty'
    : statuses.includes('saved') ? 'saved'
    : 'idle';
  const savedTimes = [savedAt, sectionSavedAt].filter(Boolean).map((value) => new Date(value).getTime());
  const combinedSavedAt = savedTimes.length ? Math.max(...savedTimes) : null;

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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setGenerationOpen((open) => !open)}
            disabled={!draft.data}
            aria-expanded={generationOpen}
            className={`btn rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 ${generationOpen ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white text-stone-700 ring-1 ring-stone-900/10 hover:bg-stone-50'}`}
          >
            Generación de secciones (IA)
          </button>
          <button onClick={handleNew} disabled={createDraft.isPending} className="btn rounded-xl bg-ink-800 px-4 py-2.5 text-sm font-medium text-stone-50 shadow-sm hover:bg-ink-700 disabled:opacity-60">
            {createDraft.isPending ? 'Creando…' : 'Nuevo borrador'}
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="space-y-2">
          <p className="px-1 text-[10px] font-medium uppercase tracking-[0.22em] text-stone-500">Borradores</p>
          {drafts.isLoading && ( <><div className="skeleton h-16" /><div className="skeleton h-16" /></> )}
          {!drafts.isLoading && list.length === 0 && (
            <p className="rounded-xl bg-white/60 px-4 py-5 text-sm text-stone-500 ring-1 ring-stone-900/10">Aún no hay borradores. Cree el primero para empezar a redactar.</p>
          )}
          {list.map((item) => (
            <div key={item.id} className={`group relative rounded-xl ring-1 transition-colors ${item.id === selectedId ? 'bg-white ring-ink-800/25 shadow-sm' : 'bg-white/50 ring-stone-900/10 hover:bg-white'}`}>
              <button onClick={() => handleSelect(item.id)} className="block w-full px-4 py-3 text-left">
                <p className="truncate text-sm font-medium text-ink-900">{item.title}</p>
                <p className="mt-0.5 truncate text-xs text-stone-500">{item.preview || 'Sin contenido'}</p>
                <p className="mt-1 text-[11px] text-stone-400 tnum">Creado el {listFmt.format(new Date(item.createdAt))}</p>
              </button>
              <button onClick={() => handleDelete(item.id)} className="btn absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-xs text-stone-400 opacity-40 hover:bg-rose-50 hover:text-rose-600 hover:opacity-100">✕</button>
            </div>
          ))}
        </aside>

        <section className="space-y-3">
          {!selectedId && !drafts.isLoading && (
            <div className="rounded-2xl bg-white px-8 py-16 text-center ring-1 ring-stone-900/10">
              <p className="font-display text-lg text-ink-900">Ningún borrador abierto</p>
              <p className="mt-1 text-sm text-stone-500">Cree un borrador nuevo o seleccione uno de la lista.</p>
            </div>
          )}

          {selectedId && draft.isLoading && ( <><div className="skeleton h-11" /><div className="skeleton h-[26rem]" /></> )}
          {selectedId && draft.isError && ( <p className="alert-in rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-600/20">No se pudo cargar el borrador.</p> )}

          {draft.data && (
            <>
              {/* BLOQUE: ESTRUCTURA OFICIAL */}
              {sectionMode && (
                <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-900/10 shadow-sm animate-fade-in">
                  <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-stone-500">Estructura del informe</p>
                  <div className="flex flex-wrap gap-2">
                    {draftSectionList.map((section) => (
                      <button
                        key={section.structureSectionId}
                        type="button"
                        onClick={() => {
                          flushSection(); setPreview(null); setPendingEvidence(null); setIncoherences(null);
                          setSelectedSectionId(section.structureSectionId);
                        }}
                        className={`btn rounded-xl px-3 py-2 text-sm font-medium ring-1 transition-colors ${section.structureSectionId === activeSectionId ? 'bg-ink-700 text-stone-50 ring-ink-700' : 'bg-stone-50 text-stone-700 ring-stone-900/10 hover:bg-stone-100'}`}
                      >
                        {section.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* BLOQUE: GENERACIÓN DE SECCIONES (IA) */}
              {generationOpen && (
                <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-900/10 shadow-sm animate-fade-in border-l-4 border-l-indigo-500">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-indigo-600">Reglas personalizadas</p>
                      <p className="mt-1 text-sm text-stone-600"></p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleCreateGenerationSection} className="btn rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-2 text-xs font-medium text-white shadow-sm">+ Añadir sección</button>
                      <button type="button" onClick={() => generationFileRef.current?.click()} className="btn rounded-lg bg-white px-3 py-2 text-xs font-medium text-stone-700 ring-1 ring-stone-900/10 hover:bg-stone-50">Importar reglas (.docx/.pdf)</button>
                      <input ref={generationFileRef} type="file" accept=".pdf,.doc,.docx" onChange={handleImportGenerationFile} className="hidden" />
                    </div>
                  </div>

                  {activeGenerationSection ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-[14rem_1fr] items-start">
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                        {generationSectionList.map((section) => (
                          <button
                            key={section.id}
                            type="button"
                            onClick={() => { setGenerationSectionId(section.id); setGenerationDraft({ name: section.name, description: section.description || '', instructions: (section.requirements?.instructions || []).join('\n') }); }}
                            className={`block w-full rounded-lg px-3 py-2 text-left text-sm ring-1 transition-colors ${section.id === activeGenerationSection.id ? 'bg-indigo-50 text-indigo-900 ring-indigo-500 font-medium' : 'bg-stone-50 text-stone-700 ring-stone-900/10 hover:bg-white'}`}
                          >
                            {section.name}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-3 bg-stone-50/50 p-4 rounded-xl border border-stone-200">
                        <input value={generationDraft.name} onChange={(e) => setGenerationDraft((draft) => ({ ...draft, name: e.target.value }))} className="w-full rounded-lg bg-white px-3 py-2 text-sm font-medium ring-1 ring-stone-900/10 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Nombre de la sección" />
                        <textarea value={generationDraft.description} onChange={(e) => setGenerationDraft((draft) => ({ ...draft, description: e.target.value }))} className="min-h-[4rem] w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-stone-900/10 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Descripción o propósito del texto a generar" />
                        <textarea value={generationDraft.instructions} onChange={(e) => setGenerationDraft((draft) => ({ ...draft, instructions: e.target.value }))} className="min-h-[6rem] w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-stone-900/10 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Instrucciones estrictas para la IA (una por línea)" />
                        <div className="flex gap-2 pt-1">
                          <button type="button" onClick={handleSaveGenerationSection} className="btn rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-medium text-white">Guardar configuración</button>
                          <button type="button" onClick={() => deleteGenerationSection.mutate({ draftId: selectedId, sectionId: activeGenerationSection.id })} className="btn rounded-lg bg-white hover:bg-rose-50 px-4 py-2 text-xs font-medium text-rose-600 ring-1 ring-stone-900/10 hover:ring-rose-200">Eliminar</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-stone-50 rounded-xl border border-stone-200">
                      <p className="text-sm text-stone-500">No hay reglas configuradas. Añade una sección para comenzar.</p>
                    </div>
                  )}
                </div>
              )}

              {/* BLOQUE: FUENTES PARA GENERAR CONTENIDO (solo dentro de Generación de secciones) */}
              {generationOpen && (
              <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-900/10 shadow-sm mt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-stone-500">Fuentes para generar contenido</p>
                    <p className="mt-1 text-sm text-stone-600">Seleccione entre 1 y 5 documentos del repositorio para extraer la información.</p>
                  </div>
                  <button type="button" onClick={handleGeneratePreview} disabled={!activeGenerationSection || selectedDocumentIds.length < 1 || generatePreview.isPending} className="btn rounded-lg bg-ink-800 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 disabled:opacity-50">
                    {generatePreview.isPending ? 'Preparando IA…' : 'Generar contenido con IA'}
                  </button>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(documents.data ?? []).map((document) => {
                    const selected = selectedDocumentIds.includes(document.id);
                    const unavailable = ['PROCESSING', 'PENDING', 'FAILED', 'ERROR'].includes(document.vectorizationStatus);
                    return (
                      <label key={document.id} className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm ring-1 transition-colors ${selected ? 'bg-indigo-50 text-indigo-900 ring-indigo-300' : 'bg-stone-50 text-stone-700 ring-stone-900/10 hover:bg-white'} ${unavailable ? 'cursor-not-allowed opacity-50' : ''}`}>
                        <input type="checkbox" checked={selected} disabled={unavailable} onChange={() => toggleDocument(document.id)} className="h-4 w-4 accent-indigo-600 rounded" />
                        <span className="min-w-0 truncate">{document.name}</span>
                      </label>
                    );
                  })}
                </div>

                <p className="mt-3 text-xs font-medium text-stone-500">{selectedDocumentIds.length}/5 seleccionados</p>
                {selectedDocumentIds.length >= 2 && (
                  <button type="button" onClick={handleDetectIncoherences} disabled={incoherenceSearch.isPending} className="btn mt-3 rounded-lg bg-white px-4 py-2 text-sm font-medium text-stone-700 ring-1 ring-stone-900/10 hover:text-ink-900 disabled:opacity-50">
                    {incoherenceSearch.isPending ? 'Analizando…' : '🔍 Buscar incoherencias entre documentos'}
                  </button>
                )}
                {incoherenceSearch.isError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-600/20">{incoherenceSearch.error?.response?.data?.error || 'No fue posible analizar las fuentes.'}</p>}
                {incoherences && (
                  <div className="mt-3 space-y-2 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-600/20">
                    <p className="text-sm font-semibold text-amber-950">{incoherences.analyzedPairs === 0
                      ? 'No se pudieron comparar los documentos: no hay fragmentos similares o aún no están indexados.'
                      : incoherences.results.length
                        ? 'Posibles contradicciones detectadas'
                        : 'No se encontraron incoherencias significativas'}</p>
                    {incoherences.results.filter((result) => result.relation === 'contradiction' || result.needsReview).map((result, index) => (
                      <article key={`${result.sourceA.documentId}-${result.sourceB.documentId}-${index}`} className="rounded-lg bg-white p-3 text-sm text-stone-700 ring-1 ring-amber-600/15">
                        <p className="font-semibold text-ink-900 mb-1">{result.sourceA.name} ↔ {result.sourceB.name}</p>
                        <p className="mb-2 leading-relaxed">{result.explanation}</p>
                        <p className="text-xs text-stone-500 uppercase tracking-wider font-medium">Confianza: {(result.confidence * 100).toFixed(0)}%</p>
                      </article>
                    ))}
                  </div>
                )}
                {generatePreview.isError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-600/20">{generatePreview.error?.response?.data?.error || 'Error al generar la vista previa.'}</p>}
              </div>
              )}

              {/* TÍTULO DEL INFORME */}
              <input value={title} onChange={(e) => { setTitle(e.target.value); schedule({ title: e.target.value }); }} onBlur={flush} aria-label="Título del borrador" placeholder="Título del borrador" className="mt-6 w-full rounded-xl bg-white px-5 py-3 font-display text-lg font-semibold text-ink-900 ring-1 ring-stone-900/10 focus:ring-ink-800/30 outline-none" />

              {/* EDITOR PRINCIPAL CON ENCABEZADO */}
              <div className="flex items-start gap-4 mt-4">
                <div className="min-w-0 flex-1 space-y-3">

                  {/* Título visual de la sección */}
                  {sectionMode && activeSection && (
                    <div className="mb-[-10px] px-5 py-3 bg-white border-b border-stone-200 rounded-t-xl">
                      <h2 className="font-display text-xl font-bold text-ink-900">
                        {activeSection.code ? `${activeSection.code}. ` : ''}{activeSection.name}
                      </h2>
                    </div>
                  )}

                  {loadedKey === currentEditorKey ? (
                    <DraftEditor
                      key={loadedKey}
                      initialHtml={localEditorHtml}
                      insertionRequest={insertionRequest}
                      onInsertionHandled={() => setInsertionRequest(null)}
                      onChange={handleEditorChange}
                      onOpenMatches={handleOpenMatches}
                    />
                  ) : (
                    <div className="skeleton h-[26rem]" />
                  )}

                  {selectionWarning && <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-600/20">{selectionWarning}</div>}

                  <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                    <SaveIndicator status={combinedStatus} savedAt={combinedSavedAt} />
                    <div className="flex items-center gap-2">
                      <button onClick={() => setHistoryOpen((v) => !v)} className="btn rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-stone-600 ring-1 ring-stone-900/10 hover:text-ink-900">{historyOpen ? 'Ocultar historial' : 'Historial de versiones'}</button>
                      <button onClick={() => handleExport('pdf')} className="btn rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-stone-600 ring-1 ring-stone-900/10 hover:text-ink-900">Exportar a PDF</button>
                      <button onClick={() => handleExport('docx')} className="btn rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-stone-600 ring-1 ring-stone-900/10 hover:text-ink-900">Exportar a DOCX</button>
                      <button
                        onClick={flushAll}
                        disabled={isSaving}
                        className="btn rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-stone-600 ring-1 ring-stone-900/10 hover:text-ink-900 disabled:opacity-50"
                      >
                        {isSaving ? 'Guardando…' : 'Guardar ahora'}
                      </button>
                    </div>
                  </div>

                  {historyOpen && <DraftHistory draftId={draft.data.id} onRestored={(restored) => { setTitle(restored.title); setSavedAt(restored.updatedAt); setStatus('idle'); setSectionStatus('idle'); pendingRef.current = {}; sectionPendingRef.current = {}; clearTimeout(timerRef.current); clearTimeout(sectionTimerRef.current); contentCacheRef.current = {}; setRestoreNonce((n) => n + 1); }} />}
                </div>

                {matchesQuery !== null && <MatchesPanel query={matchesQuery} search={matchesSearch} elapsedMs={searchElapsedMs} onRequestInsertEvidence={handleRequestInsertEvidence} onClose={() => { setMatchesQuery(null); matchesSearch.reset(); }} />}
              </div>
            </>
          )}
        </section>
      </div>

      {/* MODAL DE EVIDENCIAS Y VISTAS PREVIAS */}
      {pendingEvidence && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink-900/35 px-4 backdrop-blur-sm" role="presentation">
          <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-stone-900/15 animate-fade-in-up">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-amber-700">Revisión asistida</p>
            <h3 className="mt-2 font-display text-xl font-semibold text-ink-900">{pendingKind === 'generated' ? '¿Desea insertar el texto generado?' : '¿Desea insertar esta evidencia?'}</h3>
            <p className="mt-2 text-sm leading-6 text-stone-600">Este contenido requiere revisión antes de incorporarlo al informe oficial.</p>
            <blockquote className="mt-4 max-h-40 overflow-y-auto rounded-xl bg-stone-50 p-4 text-sm leading-6 text-stone-700 ring-1 ring-stone-900/5">{pendingEvidence}</blockquote>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setPendingEvidence(null)} className="btn rounded-lg bg-white px-4 py-2 text-sm font-medium text-stone-600 ring-1 ring-stone-900/10 hover:bg-stone-50">Descartar</button>
              <button type="button" onClick={handleConfirmInsertEvidence} className="btn rounded-lg bg-ink-800 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700">Insertar en el editor</button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink-900/35 px-4 backdrop-blur-sm" role="presentation">
          <div role="dialog" aria-modal="true" className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-stone-900/15 animate-fade-in-up">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-indigo-600">Borrador IA generado</p>
            <h3 className="mt-2 font-display text-xl font-semibold text-ink-900">Contenido extraído</h3>
            <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950 ring-1 ring-amber-600/25">
              <p className="font-bold flex items-center gap-2">⚠️ Atención: Revisión Humana Requerida</p>
              <p className="mt-1">La IA puede cometer errores o sufrir alucinaciones. Revise que los datos sean correctos.</p>
              <button type="button" onClick={handleReviewPreviewSources} disabled={selectedDocumentIds.length < 2 || incoherenceSearch.isPending} className="mt-2 font-medium text-amber-800 hover:text-amber-600 underline decoration-amber-800/40 underline-offset-2 disabled:opacity-50">
                {incoherenceSearch.isPending ? 'Analizando documentos base…' : 'Buscar incoherencias entre los documentos usados'}
              </button>
            </div>
            <div className="mt-5 max-h-64 overflow-y-auto rounded-xl bg-stone-50 p-5 text-sm leading-relaxed text-stone-800 ring-1 ring-stone-900/5 whitespace-pre-wrap">{preview.contentText}</div>
            <p className="mt-3 text-xs font-medium text-stone-500 flex justify-end">{preview.wordCount ?? countWords(preview.contentText)} / {MAX_PREVIEW_WORDS} palabras</p>
            <div className="mt-6 flex justify-end gap-3 border-t border-stone-100 pt-5">
              <button type="button" onClick={() => setPreview(null)} className="btn rounded-lg bg-white px-4 py-2 text-sm font-medium text-stone-600 ring-1 ring-stone-900/10 hover:bg-stone-50">Descartar</button>
              <button type="button" onClick={handleInsertPreview} className="btn rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white shadow-sm">Insertar en el editor principal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DraftHistory({ draftId, onRestored }) {
  const history = useReportDraftHistory(draftId);
  const restoreDraft = useRestoreReportDraft();

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-900/10">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-stone-500">Historial de versiones</p>
      {history.isLoading && <div className="skeleton h-10" />}
      {history.data && history.data.length === 0 && <p className="text-sm text-stone-500">Aún no hay instantáneas guardadas. Se crean automáticamente al redactar.</p>}
      <ul className="divide-y divide-stone-900/5">
        {(history.data ?? []).map((v) => (
          <li key={v.version} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-900">{v.title}</p>
              <p className="truncate text-xs text-stone-500">{v.preview || 'Sin contenido'}</p>
              <p className="mt-0.5 text-[11px] text-stone-400 tnum">Versión {v.version} · {listFmt.format(new Date(v.createdAt))} {v.createdBy ? ` · ${v.createdBy.name}` : ''}</p>
            </div>
            <button onClick={() => { if (window.confirm(`¿Restaurar la versión ${v.version}? Se reemplazará el contenido actual.`)) restoreDraft.mutate({ id: draftId, version: v.version }, { onSuccess: onRestored }); }} disabled={restoreDraft.isPending} className="btn shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-stone-600 ring-1 ring-stone-900/10 hover:bg-stone-50 disabled:opacity-50">Restaurar</button>
          </li>
        ))}
      </ul>
    </div>
  );
}