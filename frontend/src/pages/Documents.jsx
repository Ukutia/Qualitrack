import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDocuments } from '../hooks/useApi.js';
import FilePreviewModal from '../components/FilePreviewModal.jsx';

const fmtSize = (b) => `${(b / 1024).toFixed(0)} KB`;
const fmtDate = (d) => new Date(d).toLocaleString('es-CL');

const STATUS_STYLE = {
  Validada: 'bg-emerald-100 text-emerald-700',
  Propuesta: 'bg-amber-100 text-amber-700',
  Descartada: 'bg-slate-200 text-slate-600',
  'Sin clasificar': 'bg-slate-100 text-slate-500',
};

export default function Documents() {
  const { data: docs, isLoading } = useDocuments();
  const [previewDoc, setPreviewDoc] = useState(null);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Repositorio de evidencias</h1>
          <p className="text-slate-500 mt-1">Documentos cargados para el Criterio 9.</p>
        </div>
        <Link
          to="/upload"
          className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium"
        >
          + Cargar evidencia
        </Link>
      </header>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-slate-500">Cargando…</p>
        ) : docs.length === 0 ? (
          <p className="p-6 text-slate-500">
            Aún no hay documentos. Comience cargando una evidencia.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium w-12 text-center">Prev.</th>
                <th className="px-4 py-3 font-medium">Formato</th>
                <th className="px-4 py-3 font-medium">Tamaño</th>
                <th className="px-4 py-3 font-medium">Origen</th>
                <th className="px-4 py-3 font-medium">Ingreso</th>
                <th className="px-4 py-3 font-medium">Clasificación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docs.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/documents/${d.id}`} className="text-brand-600 hover:underline font-medium">
                      {d.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setPreviewDoc(d)}
                      className="text-slate-400 hover:text-brand-600 p-1.5 rounded-lg hover:bg-brand-50 transition-colors"
                      title="Vista Previa"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </td>
                  <td className="px-4 py-3 uppercase text-slate-500">{d.format}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtSize(d.sizeBytes)}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {d.source === 'GOOGLE_DRIVE' ? 'Google Drive' : 'Carga directa'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(d.uploadedAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_STYLE[d.associationStatus] || ''
                      }`}
                    >
                      {d.associationStatus}
                      {d.subcriterion ? ` · ${d.subcriterion}` : ''}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <FilePreviewModal
        isOpen={!!previewDoc}
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}
