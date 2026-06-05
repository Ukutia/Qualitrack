import { useRef, useState } from 'react';
import {
  useReportStructure,
  useUploadStructure,
  useParseStructureDoc,
  useStructureHistory,
  useRestoreStructure,
} from '../hooks/useApi.js';

const CHANGE_BADGE = {
  ADDED: { text: 'Agregada', cls: 'bg-emerald-100 text-emerald-700' },
  REMOVED: { text: 'Eliminada', cls: 'bg-rose-100 text-rose-700' },
  RENAMED: { text: 'Renombrada', cls: 'bg-amber-100 text-amber-700' },
};

const LEVEL_INDENT = { 1: '', 2: 'pl-5', 3: 'pl-10', 4: 'pl-14' };

function nextCode(sections) {
  const nums = sections
    .map((s) => parseInt(s.code, 10))
    .filter((n) => !Number.isNaN(n));
  return String((nums.length ? Math.max(...nums) : 0) + 1);
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function CriteriaStructure() {
  const { data, isLoading } = useReportStructure();
  const { data: history } = useStructureHistory();
  const uploadStructure = useUploadStructure();
  const restoreStructure = useRestoreStructure();
  const parseDoc = useParseStructureDoc();
  const fileInputRef = useRef(null);

  const [draft, setDraft] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(null); // version number

  // ── Carga de documento ───────────────────────────────────────────────
  function triggerFilePicker() {
    setFeedback(null);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFeedback(null);
    setParseResult(null);
    try {
      const res = await parseDoc.mutateAsync(file);
      setParseResult(res);
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Error al procesar el documento.' });
    }
  }

  function importToEditor() {
    setDraft(
      (parseResult.sections || []).map((s) => ({
        code: s.code,
        name: s.name,
        description: '',
        required: s.required,
      }))
    );
    setParseResult(null);
  }

  async function saveDirectly() {
    setFeedback(null);
    try {
      const res = await uploadStructure.mutateAsync(
        (parseResult.sections || []).map((s) => ({
          code: s.code,
          name: s.name,
          required: s.required,
        }))
      );
      setFeedback({ type: 'success', text: res.message, changes: res.changes });
      setParseResult(null);
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Error al guardar.' });
    }
  }

  // ── Editor manual ────────────────────────────────────────────────────
  function openEditor() {
    setFeedback(null);
    setParseResult(null);
    setDraft(
      (data?.sections || []).map((s) => ({
        code: s.code,
        name: s.name,
        description: s.description || '',
        required: s.required,
      }))
    );
  }

  function updateRow(i, field, value) {
    setDraft((d) => d.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }
  function addRow() {
    setDraft((d) => [...d, { code: nextCode(d), name: '', description: '', required: true }]);
  }
  function removeRow(i) {
    setDraft((d) => d.filter((_, idx) => idx !== i));
  }
  function move(i, dir) {
    setDraft((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.length) return d;
      const copy = [...d];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  async function save() {
    setFeedback(null);
    for (const s of draft) {
      if (!s.code.trim() || !s.name.trim()) {
        setFeedback({ type: 'error', text: 'Cada sección necesita un código y un nombre.' });
        return;
      }
    }
    const codes = draft.map((s) => s.code.trim());
    if (new Set(codes).size !== codes.length) {
      setFeedback({ type: 'error', text: 'Hay códigos de sección repetidos. Cada código debe ser único.' });
      return;
    }
    try {
      const res = await uploadStructure.mutateAsync(
        draft.map((s) => ({
          code: s.code.trim(),
          name: s.name.trim(),
          description: s.description.trim() || undefined,
          required: s.required,
        }))
      );
      setFeedback({ type: 'success', text: res.message, changes: res.changes });
      setDraft(null);
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Error al guardar.' });
    }
  }

  async function handleRestore(version) {
    setFeedback(null);
    setConfirmRestore(null);
    try {
      const res = await restoreStructure.mutateAsync(version);
      setFeedback({ type: 'success', text: res.message });
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Error al restaurar.' });
    }
  }

  if (isLoading) return <p className="text-slate-500">Cargando estructura…</p>;

  return (
    <div className="space-y-6">
      {/* Input oculto para selección de archivo */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={handleFileSelected}
      />

      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">Estructura oficial del informe CNA</h1>
          <p className="text-slate-500 mt-1">Versión activa: {data.version ?? '—'}</p>
        </div>
        {!draft && !parseResult && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600 px-4 py-2 text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Historial
            </button>
            <button
              onClick={triggerFilePicker}
              disabled={parseDoc.isPending}
              className="rounded-lg border border-brand-600 text-brand-600 hover:bg-brand-50 px-4 py-2 text-sm font-medium disabled:opacity-60 flex items-center gap-2"
            >
              {parseDoc.isPending ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                  Analizando…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Importar desde documento
                </>
              )}
            </button>
            <button
              onClick={openEditor}
              className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium"
            >
              Editar / nueva versión
            </button>
          </div>
        )}
      </header>

      {feedback && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            feedback.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {feedback.text}
          {feedback.changes?.length > 0 && (
            <ul className="mt-2 list-disc list-inside">
              {feedback.changes.map((c) => (
                <li key={c.code}>
                  {c.code} · {c.name} — {CHANGE_BADGE[c.changeType]?.text || c.changeType}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Vista previa de secciones detectadas ────────────────────── */}
      {parseResult && !draft && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Secciones detectadas</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Documento: <span className="font-medium text-slate-700">{parseResult.filename}</span>
                {' · '}{parseResult.totalSections} secciones encontradas
              </p>
            </div>
            <button
              onClick={() => setParseResult(null)}
              className="text-slate-400 hover:text-slate-600 text-xs shrink-0"
            >
              Descartar
            </button>
          </div>

          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
            {parseResult.sections.map((s) => (
              <div
                key={s.code}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 ${LEVEL_INDENT[s.level] || 'pl-4'}`}
              >
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-xs font-mono text-slate-400 shrink-0">{s.code}</span>
                  <span
                    className={`text-sm text-slate-800 truncate ${s.level === 1 ? 'font-semibold' : s.level === 2 ? 'font-medium' : ''}`}
                  >
                    {s.name}
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.required ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {s.required ? 'Obligatoria' : 'Opcional'}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={saveDirectly}
              disabled={uploadStructure.isPending}
              className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {uploadStructure.isPending ? 'Guardando…' : 'Confirmar y guardar como nueva versión'}
            </button>
            <button
              onClick={importToEditor}
              className="rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 text-sm font-medium"
            >
              Revisar y editar antes de guardar
            </button>
          </div>
        </div>
      )}

      {/* ── Editor visual ────────────────────────────────────────────── */}
      {draft && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
          <p className="text-sm text-slate-600">
            Edite las secciones del informe. Al guardar se crea una nueva versión y el sistema
            marca qué secciones se agregaron, eliminaron o renombraron.
          </p>

          <div className="space-y-2">
            {draft.map((row, i) => (
              <div key={i} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <input
                    value={row.code}
                    onChange={(e) => updateRow(i, 'code', e.target.value)}
                    placeholder="N°"
                    className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <div className="flex-1 space-y-2">
                    <input
                      value={row.name}
                      onChange={(e) => updateRow(i, 'name', e.target.value)}
                      placeholder="Nombre de la sección"
                      className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <input
                      value={row.description}
                      onChange={(e) => updateRow(i, 'description', e.target.value)}
                      placeholder="Descripción (qué debe contener según la CNA)"
                      className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={row.required}
                        onChange={(e) => updateRow(i, 'required', e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Sección obligatoria
                    </label>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      title="Subir"
                      className="rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-40 px-2 py-1 text-xs"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === draft.length - 1}
                      title="Bajar"
                      className="rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-40 px-2 py-1 text-xs"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeRow(i)}
                      title="Eliminar sección"
                      className="rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 px-2 py-1 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addRow}
            className="w-full rounded-lg border-2 border-dashed border-slate-300 hover:border-brand-500 text-slate-500 hover:text-brand-600 py-2 text-sm font-medium"
          >
            + Agregar sección
          </button>

          <div className="flex gap-3 pt-2">
            <button
              onClick={save}
              disabled={uploadStructure.isPending}
              className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {uploadStructure.isPending ? 'Guardando…' : 'Guardar nueva versión'}
            </button>
            <button
              onClick={() => setDraft(null)}
              className="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Vista de solo lectura ─────────────────────────────────────── */}
      {!draft && !parseResult && (
        <div className="bg-white rounded-xl shadow-sm divide-y divide-slate-100">
          {data.sections.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No hay estructura definida. Importe un documento oficial o edite manualmente.
            </div>
          ) : (
            data.sections.map((s) => (
              <div key={s.code} className="p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-800">
                    {s.code}. {s.name}
                  </p>
                  {s.description && <p className="text-sm text-slate-500 mt-0.5">{s.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {CHANGE_BADGE[s.changeType] && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CHANGE_BADGE[s.changeType].cls}`}>
                      {CHANGE_BADGE[s.changeType].text}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      s.required ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Historial de versiones ────────────────────────────────────── */}
      {showHistory && !draft && !parseResult && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
          <h2 className="text-base font-semibold text-slate-800">Historial de versiones</h2>

          {!history || history.length === 0 ? (
            <p className="text-sm text-slate-400">No hay versiones registradas.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((v) => (
                <div key={v.version} className="py-3 flex items-start justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">
                        Versión {v.version}
                      </span>
                      {v.active && (
                        <span className="rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5">
                          Activa
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatDate(v.uploadedAt)}
                      {' · '}{v.sectionCount} secciones
                      {v.uploadedBy && (
                        <> · <span className="text-slate-700 font-medium">{v.uploadedBy.name}</span></>
                      )}
                    </p>
                    {v.note && (
                      <p className="text-xs text-amber-600 italic">{v.note}</p>
                    )}
                  </div>

                  {!v.active && (
                    <div className="shrink-0">
                      {confirmRestore === v.version ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">¿Confirmar restauración?</span>
                          <button
                            onClick={() => handleRestore(v.version)}
                            disabled={restoreStructure.isPending}
                            className="rounded-md bg-brand-600 hover:bg-brand-700 text-white text-xs px-3 py-1.5 font-medium disabled:opacity-60"
                          >
                            {restoreStructure.isPending ? 'Restaurando…' : 'Sí, restaurar'}
                          </button>
                          <button
                            onClick={() => setConfirmRestore(null)}
                            className="rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs px-2 py-1.5"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRestore(v.version)}
                          className="rounded-md border border-slate-300 hover:bg-slate-50 text-slate-600 text-xs px-3 py-1.5 font-medium"
                        >
                          Restaurar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
