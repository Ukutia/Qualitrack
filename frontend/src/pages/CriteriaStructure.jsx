import { useRef, useState } from 'react';
import {
  useReportStructure,
  useUploadStructure,
  useExtractStructure,
} from '../hooks/useApi.js';

const CHANGE_BADGE = {
  ADDED: { text: 'Agregada', cls: 'bg-emerald-100 text-emerald-700' },
  REMOVED: { text: 'Eliminada', cls: 'bg-rose-100 text-rose-700' },
  RENAMED: { text: 'Renombrada', cls: 'bg-amber-100 text-amber-700' },
};

// Sugiere el siguiente código numérico disponible.
function nextCode(sections) {
  const nums = sections
    .map((s) => parseInt(s.code, 10))
    .filter((n) => !Number.isNaN(n));
  return String((nums.length ? Math.max(...nums) : 0) + 1);
}

export default function CriteriaStructure() {
  const { data, isLoading } = useReportStructure();
  const uploadStructure = useUploadStructure();
  const extract = useExtractStructure();
  const [draft, setDraft] = useState(null); // null = editor cerrado
  const [feedback, setFeedback] = useState(null);
  const [preview, setPreview] = useState(null); // resultado de detección por archivo
  const fileInputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;
    setFeedback(null);
    setPreview(null);
    try {
      const res = await extract.mutateAsync(file);
      setPreview({ fileName: file.name, ...res });
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'No se pudo leer el archivo.' });
    }
  }

  // Carga las secciones detectadas en el editor para que el usuario confirme/edite.
  function confirmPreview() {
    setDraft(
      preview.sections.map((s) => ({
        code: String(s.code),
        name: s.name,
        description: '',
        required: true,
      }))
    );
    setPreview(null);
  }

  function openEditor() {
    // Precarga la estructura activa para editar de forma incremental.
    setFeedback(null);
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
    // Validaciones de UX antes de enviar.
    if (!draft.length) {
      setFeedback({
        type: 'error',
        text: 'Debes tener al menos una sección con número y nombre antes de guardar.',
      });
      return;
    }
    for (const s of draft) {
      if (!s.code.trim() || !s.name.trim()) {
        setFeedback({
          type: 'error',
          text: 'Hay secciones sin nombre ni número. Completa todos los campos antes de guardar.',
        });
        return;
      }
    }
    // El número de sección solo acepta enteros positivos.
    for (const s of draft) {
      if (!/^\d+$/.test(s.code.trim()) || Number(s.code) < 1) {
        setFeedback({
          type: 'error',
          text: 'El número de sección debe ser un número entero positivo (1, 2, 3…).',
        });
        return;
      }
    }
    const codes = draft.map((s) => s.code.trim());
    if (new Set(codes).size !== codes.length) {
      setFeedback({ type: 'error', text: 'Hay números de sección repetidos. Cada número debe ser único.' });
      return;
    }
    try {
      // Se ordena de menor a mayor automáticamente al guardar.
      const ordered = [...draft].sort((a, b) => Number(a.code) - Number(b.code));
      const res = await uploadStructure.mutateAsync(
        ordered.map((s) => ({
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

  if (isLoading) return <p className="text-slate-500">Cargando estructura…</p>;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Estructura oficial del informe CNA</h1>
          <p className="text-slate-500 mt-1">Versión activa: {data.version ?? '—'}</p>
        </div>
        {!draft && (
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              onChange={handleFile}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={extract.isPending}
              className="rounded-lg border border-brand-600 text-brand-700 hover:bg-brand-50 px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {extract.isPending
                ? 'Leyendo archivo…'
                : data.version
                ? 'Reemplazar desde PDF/DOCX'
                : 'Cargar desde PDF/DOCX'}
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

      {/* ── Previsualización de secciones detectadas en el archivo ─── */}
      {preview && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-800">Secciones detectadas</h2>
              <p className="text-sm text-slate-500">
                Archivo: <span className="font-medium">{preview.fileName}</span> — {preview.message}
              </p>
            </div>
            <button
              onClick={() => setPreview(null)}
              className="rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 text-sm shrink-0"
            >
              Cancelar
            </button>
          </div>

          {preview.sections.length === 0 ? (
            <div className="rounded-lg bg-amber-50 text-amber-700 px-4 py-3 text-sm">
              No se encontraron secciones en el archivo. Verifica que el documento use
              encabezados o títulos numerados, o crea la estructura manualmente.
            </div>
          ) : (
            <>
              {/* Listado de secciones detectadas */}
              <ol className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {preview.sections.map((s) => (
                  <li key={s.code} className="px-4 py-2 text-sm text-slate-700">
                    <span className="font-medium text-slate-500 mr-2">{s.code}.</span>
                    {s.name}
                  </li>
                ))}
              </ol>

              {/* Diferencias respecto de la versión activa (reemplazo) */}
              {preview.hasPrevious && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    Cambios respecto de la versión activa (v{data.version}):
                  </p>
                  {preview.diff.filter((d) => d.changeType !== 'NONE').length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No hay diferencias con la estructura actual.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {preview.diff
                        .filter((d) => d.changeType !== 'NONE')
                        .map((d) => (
                          <li key={`${d.changeType}-${d.code}-${d.name}`} className="flex items-center gap-2 text-sm">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                CHANGE_BADGE[d.changeType]?.cls || ''
                              }`}
                            >
                              {CHANGE_BADGE[d.changeType]?.text || d.changeType}
                            </span>
                            <span className="text-slate-700">
                              {d.code}. {d.name}
                              {d.changeType === 'RENAMED' && d.previousName && (
                                <span className="text-slate-400"> (antes: {d.previousName})</span>
                              )}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={confirmPreview}
                  className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium"
                >
                  {preview.hasPrevious ? 'Confirmar reemplazo' : 'Confirmar carga'}
                </button>
                <button
                  onClick={() => setPreview(null)}
                  className="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Editor visual ───────────────────────────────────────── */}
      {draft ? (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Edite las secciones del informe. Al guardar se crea una nueva versión y el sistema
              marca qué secciones se agregaron, eliminaron o renombraron.
            </p>
          </div>

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
      ) : (
        /* ── Vista de solo lectura ──────────────────────────────── */
        <div className="bg-white rounded-xl shadow-sm divide-y divide-slate-100">
          {data.sections.map((s) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
