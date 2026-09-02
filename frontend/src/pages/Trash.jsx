import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrash, useRestoreDocument, useDestroyDocument, useRestoreMultipleDocuments, useRestoreAllDocuments } from '../hooks/useApi.js';

const fmtDate = (d) => new Date(d).toLocaleString('es-CL');
const fmtSize = (b) => `${(b / 1024).toFixed(0)} KB`;

export default function Trash() {
  const { data: docs, isLoading } = useTrash();
  const restore = useRestoreDocument();
  const destroy = useDestroyDocument();
  const restoreMultiple = useRestoreMultipleDocuments();
  const restoreAll = useRestoreAllDocuments();
  const [confirmId, setConfirmId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());

  async function handleRestore(id) {
    await restore.mutateAsync(id);
  }

  async function handleDestroy(id) {
    await destroy.mutateAsync(id);
    setConfirmId(null);
  }

  function toggleSelect(id) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  }

  function selectAll() {
    if (docs?.length) {
      setSelectedIds(new Set(docs.map((d) => d.id)));
    }
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  async function handleRestoreSelected() {
    if (selectedIds.size === 0) {
      alert('Selecciona al menos un documento');
      return;
    }
    if (!confirm(`¿Restaurar ${selectedIds.size} documento(s) al repositorio?`)) return;
    await restoreMultiple.mutateAsync(Array.from(selectedIds));
    setSelectedIds(new Set());
  }

  async function handleRestoreAll() {
    if (!docs?.length) {
      alert('No hay documentos para restaurar');
      return;
    }
    if (!confirm(`¿Restaurar TODOS los ${docs.length} documentos al repositorio?`)) return;
    await restoreAll.mutateAsync();
    setSelectedIds(new Set());
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">
            Papelera
          </h1>
          <p className="text-steel-500 mt-1">
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

      {/* Barra de acciones masivas cuando hay selección */}
      {selectedIds.size > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center justify-between">
          <div className="text-sm font-medium text-emerald-900">
            {selectedIds.size} documento(s) seleccionado(s)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={deselectAll}
              className="text-xs px-3 py-2 rounded-md border border-steel-200 hover:bg-steel-50 text-steel-600"
            >
              Deseleccionar
            </button>
            <button
              onClick={handleRestoreSelected}
              disabled={restoreMultiple.isPending}
              className="text-xs px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
            >
              {restoreMultiple.isPending ? 'Restaurando…' : 'Restaurar'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl2 shadow-soft ring-1 ring-steel-200/60 overflow-hidden">
        {isLoading ? (
          <p className="px-6 py-10 text-sm text-steel-400">Cargando papelera…</p>
        ) : docs?.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-steel-50 ring-1 ring-steel-200">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-steel-400" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 className="mt-4 font-display text-lg font-semibold text-ink-900">La papelera está vacía</h2>
            <p className="mt-1 text-sm text-steel-500">Los documentos que elimines aparecerán aquí.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-steel-50/80 text-steel-500 text-left">
              <tr>
                <th className="px-5 py-3.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === docs.length && docs.length > 0}
                    onChange={selectedIds.size === docs.length ? deselectAll : selectAll}
                    className="h-4 w-4 rounded border-steel-300 text-emerald-600 cursor-pointer"
                  />
                </th>
                {['Nombre', 'Formato', 'Tamaño', 'Eliminado el', ''].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-100">
              {docs.map((d) => (
                <tr 
                  key={d.id} 
                  className={`hover:bg-steel-50/60 transition-colors ${selectedIds.has(d.id) ? 'bg-emerald-50' : ''}`}
                >
                  <td className="px-5 py-3.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.id)}
                      onChange={() => toggleSelect(d.id)}
                      className="h-4 w-4 rounded border-steel-300 text-emerald-600 cursor-pointer"
                    />
                  </td>
                  <td className="px-5 py-3.5 font-medium text-ink-900">{d.name}</td>
                  <td className="px-5 py-3.5 uppercase text-steel-500">{d.format}</td>
                  <td className="px-5 py-3.5 tnum text-steel-500">{fmtSize(d.sizeBytes)}</td>
                  <td className="px-5 py-3.5 tnum text-steel-500">{fmtDate(d.deletedAt)}</td>
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
                          className="rounded-md bg-steel-100 hover:bg-steel-200 text-steel-600 px-2.5 py-1 text-xs font-medium"
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

      {/* Barra flotante con botones de acciones masivas */}
      {docs?.length > 0 && selectedIds.size === 0 && (
        <div className="flex justify-end gap-2">
          <button
            onClick={selectAll}
            className="text-xs px-4 py-2 rounded-lg border border-steel-200 hover:bg-steel-50 text-steel-600 font-medium"
          >
            ☑️ Seleccionar todo
          </button>
          <button
            onClick={handleRestoreAll}
            disabled={restoreAll.isPending}
            className="text-xs px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50"
          >
            {restoreAll.isPending ? '⏳ Restaurando…' : '✓ Restaurar todo'}
          </button>
        </div>
      )}
    </div>
  );
}
