import { useEffect, useState } from 'react';
import SelectionCheckbox from '../components/SelectionCheckbox.jsx';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDocuments, useTrashDocument } from '../hooks/useApi.js';
import { ANALYSIS_LABELS, normalizeAnalysisStatus } from '../lib/analysisStatus.js';

async function openFile(docId) {
  const token = localStorage.getItem('qualitrack_token');
  const res = await fetch(`/api/documents/${docId}/file`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

const fmtSize = (b) => b >= 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`;
const sourceLabel = (source) => ({
  GOOGLE_DRIVE: 'Google Drive',
  DROPBOX: 'Dropbox',
  UPLOAD: 'Carga directa',
}[source] || '—');

const STATUS_STYLE = {
  Validada: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  Propuesta: 'bg-amber-100 text-amber-700 ring-amber-200',
  Descartada: 'bg-steel-200 text-steel-600 ring-steel-300',
  'Sin clasificar': 'bg-steel-100 text-steel-500 ring-steel-200',
};

function OpenFileButton({ docId }) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    await openFile(docId);
    setLoading(false);
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 ring-1 ring-steel-200 hover:ring-brand-200 transition-colors disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {loading ? 'Abriendo…' : 'Ver archivo'}
    </button>
  );
}

export default function Documents() {
  const { data: docs = [], isLoading, isError, refetch } = useDocuments();
  const trash = useTrashDocument();
  const location = useLocation();
  const navigate = useNavigate();
  const [highlightedIds] = useState(() => new Set(location.state?.importedIds || []));
  const [selectedIds, setSelectedIds] = useState(new Set());
  const selectableIds = docs.filter((doc) => doc.vectorizationStatus !== 'PROCESSING').map((doc) => doc.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const partiallySelected = !allSelected && selectableIds.some((id) => selectedIds.has(id));

  useEffect(() => {
    if (location.state?.importedIds) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleTrash(id, name) {
    if (!confirm(`¿Mover "${name}" a la papelera?`)) return;

    await trash.mutateAsync(id);
    await refetch();
  }

  function toggleSelect(id) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

function toggleSelectAll() {
    if (!docs?.length) return;

    const selectableIds = docs
      .filter((doc) => doc.vectorizationStatus !== 'PROCESSING')
      .map((doc) => doc.id);

    if (selectableIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  }

  async function handleTrashSelected() {
    if (selectedIds.size === 0) return;

    if (
      !confirm(
        `¿Mover ${selectedIds.size} documento(s) seleccionado(s) a la papelera?`
      )
    ) {
      return;
    }

    for (const id of selectedIds) {
      await trash.mutateAsync(id);
    }

    setSelectedIds(new Set());
    await refetch();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">
            Repositorio de evidencias
          </h1>
          <p className="text-steel-500 mt-1">Documentos cargados para el Criterio 9.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/trash"
            className="inline-flex items-center gap-2 rounded-lg border border-steel-200 hover:bg-steel-50 text-steel-600 px-4 py-2.5 text-sm font-medium transition-colors"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14M10 10v7m4-7v7" />
            </svg>
            Papelera
          </Link>
          <Link
            to="/upload"
            className="btn rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 text-sm font-medium shadow-soft hover:shadow-lift"
          >
            Cargar evidencia
          </Link>
        </div>
      </header>

      {selectedIds.size > 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 flex flex-wrap gap-3 items-center justify-between">
          <span className="text-sm font-medium text-brand-900">
            {selectedIds.size} documento(s) seleccionado(s)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs px-3 py-2 rounded-md border border-steel-200 hover:bg-steel-50 text-steel-600"
            >
              Deseleccionar
            </button>

            <button
              onClick={handleTrashSelected}
              disabled={trash.isPending}
              className="text-xs px-3 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
            >
              {trash.isPending
                ? 'Moviendo…'
                : `Mover ${selectedIds.size} a papelera`}
            </button>
          </div>
        </div>
      )}

      <div className="min-w-0 bg-white rounded-xl2 shadow-soft ring-1 ring-steel-200/60 overflow-hidden">
        <div role="region" aria-label="Tabla de evidencias, desplazable horizontalmente" tabIndex={0} className="overflow-x-auto overscroll-x-contain">
        {isError ? <div role="alert" className="p-8 text-center text-sm text-rose-700">No se pudo cargar el repositorio. <button onClick={() => refetch()} className="font-medium underline">Reintentar</button></div> : isLoading ? (
          <table className="w-full min-w-[960px] table-fixed text-sm">
            <colgroup><col className="w-12" /><col /><col className="w-28" /><col className="w-32" /><col className="w-36" /><col className="w-36" /><col className="w-28" /></colgroup>
            <thead className="bg-steel-50/80 text-steel-500 text-left">
              <tr>
                {['Selección','Documento','Origen','Ingreso','Clasificación','Análisis','Acciones'].map(h => (
                  <th key={h} scope="col" className={`px-4 py-3.5 text-xs font-semibold uppercase tracking-wide ${(h === 'Acciones' || h === 'Análisis') ? 'text-center' : ''}`}>{h === 'Selección' ? <span className="sr-only">Selección</span> : h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-4"> <div className="skeleton h-4 w-4" /></td>
                  <td className="px-5 py-4"><div className="skeleton h-4 w-full" /></td>
                  <td className="px-5 py-4"><div className="skeleton h-4 w-24" /></td>
                  <td className="px-5 py-4"><div className="skeleton h-4 w-32" /></td>
                  <td className="px-5 py-4"><div className="skeleton h-5 w-20 rounded-full" /></td>
                  <td className="px-5 py-4"><div className="skeleton h-5 w-full rounded-md" /></td>
                  <td className="px-5 py-4"><div className="skeleton h-6 w-20 rounded-md" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : docs?.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 ring-1 ring-brand-100">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-brand-500" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 7V5a2 2 0 0 1 2-2h5l2 2h5a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 7h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 className="mt-4 font-display text-lg font-semibold text-ink-900">Aún no hay evidencias</h2>
            <p className="mt-1 max-w-sm text-sm text-steel-500">
              Carga tu primer documento para empezar a construir el respaldo del Criterio 9.
            </p>
            <Link
              to="/upload"
              className="btn mt-5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 text-sm font-medium shadow-soft hover:shadow-lift"
            >
              Cargar evidencia
            </Link>
          </div>
        ) : (
          <table className="w-full min-w-[960px] table-fixed text-sm">
            <caption className="sr-only">Evidencias, origen, fecha de ingreso, clasificación, análisis y acciones.</caption>
            <colgroup><col className="w-12" /><col /><col className="w-28" /><col className="w-32" /><col className="w-36" /><col className="w-36" /><col className="w-28" /></colgroup>
            <thead className="bg-steel-50/80 text-steel-500 text-left">
              <tr>
                <th scope="col" className="px-4 py-3.5">
                  <SelectionCheckbox
                    aria-label="Seleccionar todas las evidencias disponibles"
                    checked={allSelected}
                    indeterminate={partiallySelected}
                    disabled={trash.isPending || !selectableIds.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                {['Documento','Origen','Ingreso','Clasificación','Análisis','Acciones'].map((h) => (
                  <th key={h} scope="col" className={`px-4 py-3.5 text-xs font-semibold uppercase tracking-wide ${(h === 'Acciones' || h === 'Análisis') ? 'text-center' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-100">
              {docs.map((d) => (
                <tr
                  key={d.id}
                  className={`transition-colors hover:bg-brand-50/40 ${
                    highlightedIds.has(d.id) ? 'animate-pulse-highlight' : ''
                  } ${
                    selectedIds.has(d.id) ? 'bg-brand-50' : ''
                  }`}
                >
                  <td className="px-4 py-4 align-top">
                    <SelectionCheckbox
                      aria-label={`Seleccionar ${d.name}`}
                      checked={selectedIds.has(d.id)}
                      onChange={() => toggleSelect(d.id)}
                      disabled={d.vectorizationStatus === 'PROCESSING'}
                      title={d.vectorizationStatus === 'PROCESSING' ? 'No se puede eliminar mientras se prepara para la búsqueda semántica.' : undefined}
                    />
                  </td>
                  <td className="px-4 py-4 align-top">
                    <Link to={`/documents/${d.id}`} className="block font-medium leading-5 text-brand-700 [overflow-wrap:anywhere] hover:underline underline-offset-2">
                      {d.name}
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-steel-600"><span className="rounded border border-steel-200 bg-steel-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase">{d.format}</span><span className="tabular-nums">{fmtSize(d.sizeBytes)}</span></div>
                  </td>
                  <td className="px-4 py-4 align-top text-xs leading-5 text-steel-600">
                    {sourceLabel(d.source)}
                  </td>
                  <td className="px-4 py-4 align-top text-xs tnum text-steel-700"><time dateTime={d.uploadedAt}>{new Date(d.uploadedAt).toLocaleDateString('es-CL')}<span className="mt-1 block text-steel-600">{new Date(d.uploadedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span></time></td>
                  <td className="px-4 py-4 align-top">
                    <span
                      className={`inline-block max-w-full rounded-md px-2 py-1 text-xs leading-5 font-medium ring-1 ring-inset ${
                        STATUS_STYLE[d.associationStatus] || ''
                      }`}
                    >
                      {d.associationStatus}
                    </span>
                    {d.subcriterion && <p className="mt-2 text-xs text-steel-600">Subcriterio {d.subcriterion}</p>}
                  </td>
                  <td className="px-4 py-4 align-top text-center">
                    <span className={`inline-flex max-w-full rounded-md px-2 py-1 text-xs leading-5 font-medium ${normalizeAnalysisStatus(d.analysisStatus) === 'ERROR' ? 'bg-rose-50 text-rose-800' : normalizeAnalysisStatus(d.analysisStatus) === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800' : 'bg-brand-50 text-brand-800'}`}>
                      {ANALYSIS_LABELS[normalizeAnalysisStatus(d.analysisStatus)]}
                    </span>
                    {d.vectorizationStatus === 'PROCESSING' && <p className="mt-2 text-xs text-steel-600">Preparando búsqueda…</p>}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex items-center justify-center gap-2">
                      {/* <OpenFileButton docId={d.id} /> */}
                      <span className="group relative z-10 inline-flex hover:z-30">
                      <button
                          onClick={() => handleTrash(d.id, d.name)}
                          disabled={trash.isPending || d.vectorizationStatus === 'PROCESSING'}
                          aria-label={`Mover ${d.name} a la papelera`}
                          title={d.vectorizationStatus === 'PROCESSING' ? 'No se puede eliminar mientras se prepara para las búsquedas.' : 'Mover a papelera'}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs text-steel-600 hover:text-rose-700 hover:bg-rose-50 ring-1 ring-steel-200 hover:ring-rose-200 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>
      </div>
    </div>
  );
}
