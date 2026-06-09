import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrash, useRestoreDocument, useDestroyDocument } from '../hooks/useApi.js';

const fmtDate = (d) => new Date(d).toLocaleString('es-CL');
const fmtSize = (b) => `${(b / 1024).toFixed(0)} KB`;

export default function Trash() {
  const { data: docs, isLoading } = useTrash();
  const restore = useRestoreDocument();
  const destroy = useDestroyDocument();
  const [confirmId, setConfirmId] = useState(null);

  async function handleRestore(id) {
    await restore.mutateAsync(id);
  }

  async function handleDestroy(id) {
    await destroy.mutateAsync(id);
    setConfirmId(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">
            Papelera
          </h1>
          <p className="text-stone-500 mt-1">
            Documentos eliminados. Puedes restaurarlos o eliminarlos definitivamente.
          </p>
        </div>
        <Link
          to="/documents"
          className="text-sm text-brand-600 hover:underline"
        >
          ← Volver al repositorio
        </Link>
      </header>

      <div className="bg-white rounded-xl2 shadow-soft ring-1 ring-stone-200/60 overflow-hidden">
        {isLoading ? (
          <p className="px-6 py-10 text-sm text-stone-400">Cargando papelera…</p>
        ) : docs?.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-stone-50 ring-1 ring-stone-200">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-stone-400" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 className="mt-4 font-display text-lg font-semibold text-ink-900">La papelera está vacía</h2>
            <p className="mt-1 text-sm text-stone-500">Los documentos que elimines aparecerán aquí.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50/80 text-stone-500 text-left">
              <tr>
                {['Nombre', 'Formato', 'Tamaño', 'Eliminado el', ''].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {docs.map((d) => (
                <tr key={d.id} className="hover:bg-stone-50/60">
                  <td className="px-5 py-3.5 font-medium text-ink-900">{d.name}</td>
                  <td className="px-5 py-3.5 uppercase text-stone-500">{d.format}</td>
                  <td className="px-5 py-3.5 tnum text-stone-500">{fmtSize(d.sizeBytes)}</td>
                  <td className="px-5 py-3.5 tnum text-stone-500">{fmtDate(d.deletedAt)}</td>
                  <td className="px-5 py-3.5">
                    {confirmId === d.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-rose-600 font-medium">¿Eliminar definitivamente?</span>
                        <button
                          onClick={() => handleDestroy(d.id)}
                          disabled={destroy.isPending}
                          className="rounded-md bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 text-xs font-medium disabled:opacity-50"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="rounded-md bg-stone-100 hover:bg-stone-200 text-stone-600 px-2.5 py-1 text-xs font-medium"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestore(d.id)}
                          disabled={restore.isPending}
                          className="rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 px-2.5 py-1 text-xs font-medium disabled:opacity-50"
                        >
                          Restaurar
                        </button>
                        <button
                          onClick={() => setConfirmId(d.id)}
                          className="rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 ring-1 ring-rose-200 px-2.5 py-1 text-xs font-medium"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
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
