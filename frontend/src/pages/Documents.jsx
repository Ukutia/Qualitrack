import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDocuments, useTrashDocument } from '../hooks/useApi.js';

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

const fmtSize = (b) => `${(b / 1024).toFixed(0)} KB`;
const fmtDate = (d) => new Date(d).toLocaleString('es-CL');

const STATUS_STYLE = {
  Validada: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  Propuesta: 'bg-amber-100 text-amber-700 ring-amber-200',
  Descartada: 'bg-stone-200 text-stone-600 ring-stone-300',
  'Sin clasificar': 'bg-stone-100 text-stone-500 ring-stone-200',
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
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 ring-1 ring-stone-200 hover:ring-brand-200 transition-colors disabled:opacity-50"
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
  const { data: docs, isLoading } = useDocuments();
  const trash = useTrashDocument();

  async function handleTrash(id, name) {
    if (!confirm(`¿Mover "${name}" a la papelera?`)) return;
    await trash.mutateAsync(id);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">
            Repositorio de evidencias
          </h1>
          <p className="text-stone-500 mt-1">Documentos cargados para el Criterio 9.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/trash"
            className="rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-500 px-4 py-2.5 text-sm font-medium"
          >
            🗑 Papelera
          </Link>
          <Link
            to="/upload"
            className="btn rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 text-sm font-medium shadow-soft hover:shadow-lift"
          >
            Cargar evidencia
          </Link>
        </div>
      </header>

      <div className="bg-white rounded-xl2 shadow-soft ring-1 ring-stone-200/60 overflow-hidden">
        {isLoading ? (
          <table className="w-full text-sm">
            <thead className="bg-stone-50/80 text-stone-500 text-left">
              <tr>
                {['Nombre','Formato','Tamaño','Origen','Ingreso','Clasificación',''].map(h => (
                  <th key={h} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-4"><div className="skeleton h-4 w-44" /></td>
                  <td className="px-5 py-4"><div className="skeleton h-4 w-10" /></td>
                  <td className="px-5 py-4"><div className="skeleton h-4 w-14" /></td>
                  <td className="px-5 py-4"><div className="skeleton h-4 w-24" /></td>
                  <td className="px-5 py-4"><div className="skeleton h-4 w-32" /></td>
                  <td className="px-5 py-4"><div className="skeleton h-5 w-20 rounded-full" /></td>
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
            <p className="mt-1 max-w-sm text-sm text-stone-500">
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
          <table className="w-full text-sm">
            <thead className="bg-stone-50/80 text-stone-500 text-left">
              <tr>
                {['Nombre','Formato','Tamaño','Origen','Ingreso','Clasificación',''].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {docs.map((d) => (
                <tr key={d.id} className="transition-colors hover:bg-brand-50/40">
                  <td className="px-5 py-3.5">
                    <Link to={`/documents/${d.id}`} className="font-medium text-brand-600 hover:text-brand-700 hover:underline underline-offset-2">
                      {d.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 uppercase text-stone-500">{d.format}</td>
                  <td className="px-5 py-3.5 tnum text-stone-500">{fmtSize(d.sizeBytes)}</td>
                  <td className="px-5 py-3.5 text-stone-500">
                    {d.source === 'GOOGLE_DRIVE' ? 'Google Drive' : 'Carga directa'}
                  </td>
                  <td className="px-5 py-3.5 tnum text-stone-500">{fmtDate(d.uploadedAt)}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                        STATUS_STYLE[d.associationStatus] || ''
                      }`}
                    >
                      {d.associationStatus}
                      {d.subcriterion ? ` · ${d.subcriterion}` : ''}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {/* <OpenFileButton docId={d.id} /> */}
                      <button
                        onClick={() => handleTrash(d.id, d.name)}
                        disabled={trash.isPending}
                        title="Mover a papelera"
                        className="inline-flex items-center rounded-md px-2 py-1 text-xs text-stone-400 hover:text-rose-500 hover:bg-rose-50 ring-1 ring-stone-200 hover:ring-rose-200 transition-colors disabled:opacity-50"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}