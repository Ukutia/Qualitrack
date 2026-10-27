import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrash, useRestoreDocument, useDestroyDocument } from '../hooks/useApi.js';
import SelectionCheckbox from '../components/SelectionCheckbox.jsx';
import { usePermission } from '../hooks/usePermission.js';
import { MODULES } from '../lib/permissions.js';
import ReadOnlyNotice from '../components/ReadOnlyNotice.jsx';

const fmtSize = (b) => b >= 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`;

export default function Trash() {
  const { data: docs = [], isLoading, isError, refetch } = useTrash();
  const restore = useRestoreDocument();
  const destroy = useDestroyDocument();
  // La papelera es parte del Repositorio: con solo lectura no se restaura ni elimina.
  const { canWrite } = usePermission(MODULES.REPOSITORIO);
  const [confirmId, setConfirmId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const allSelected = docs.length > 0 && docs.every((doc) => selectedIds.has(doc.id));
  const someSelected = !allSelected && docs.some((doc) => selectedIds.has(doc.id));

  function clearSelection(id) {
    setSelectedIds((current) => { const next = new Set(current); next.delete(id); return next; });
  }

  async function handleRestore(id) {
    await restore.mutateAsync(id);
    clearSelection(id);
  }

  async function handleDestroy(id) {
    await destroy.mutateAsync(id);
    clearSelection(id);
    setConfirmId(null);
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (docs.every((doc) => prev.has(doc.id))) {
        return new Set();
      }

      return new Set(docs.map((d) => d.id));
    });
  }

  async function handleRestoreSelected() {
    if (selectedIds.size === 0) return;

    if (!confirm(`¿Restaurar ${selectedIds.size} documento(s)?`)) return;

    for (const id of selectedIds) {
      await restore.mutateAsync(id);
    }

    setSelectedIds(new Set());
  }

  async function handleDestroySelected() {
    if (selectedIds.size === 0) return;

    if (
      !confirm(
        `¿Eliminar definitivamente ${selectedIds.size} documento(s)? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    for (const id of selectedIds) {
      await destroy.mutateAsync(id);
    }

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

      {!canWrite && <ReadOnlyNotice />}

      {canWrite && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-steel-50 px-4 py-3 ring-1 ring-steel-200">
          <span className="text-sm font-medium text-steel-600">
            {selectedIds.size} documento(s) seleccionado(s)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRestoreSelected}
              disabled={restore.isPending || destroy.isPending}
              className="rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              Restaurar seleccionados
            </button>

            <button
              onClick={handleDestroySelected}
              disabled={restore.isPending || destroy.isPending}
              className="rounded-md bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              Eliminar seleccionados
            </button>
          </div>
        </div>
      )}

      <div className="min-w-0 bg-white rounded-xl2 shadow-soft ring-1 ring-steel-200/60 overflow-hidden">
        <div role="region" aria-label="Tabla de papelera, desplazable horizontalmente" tabIndex={0} className="overflow-x-auto overscroll-x-contain">
        {isError ? <div role="alert" className="p-8 text-center text-sm text-rose-700">No se pudo cargar la papelera. <button onClick={() => refetch()} className="font-medium underline">Reintentar</button></div> : isLoading ? (
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
          <table className="w-full min-w-[720px] table-fixed text-sm">
            <caption className="sr-only">Documentos en papelera, fecha de eliminación y acciones para restaurar o eliminar definitivamente.</caption>
            <colgroup><col className="w-12" /><col /><col className="w-40" /><col className="w-48" /></colgroup>
            <thead className="bg-steel-50/80 text-steel-500 text-left">
              <tr>
                <th scope="col" className="px-4 py-3.5">
                  <SelectionCheckbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    disabled={!canWrite || restore.isPending || destroy.isPending}
                    onChange={toggleSelectAll}
                    aria-label="Seleccionar todos"
                  />
                </th>
                {['Documento', 'Eliminado el', 'Acciones'].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className={`px-4 py-3.5 text-xs font-semibold uppercase tracking-wide ${h === 'Acciones' ? 'text-center' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-100">
              {docs.map((d) => (
                <tr key={d.id} className={`transition-colors hover:bg-brand-50/40 ${selectedIds.has(d.id) ? 'bg-brand-50/70' : ''}`}>
                  <td className="px-4 py-4 align-top">
                    <SelectionCheckbox
                      checked={selectedIds.has(d.id)}
                      onChange={() => toggleSelect(d.id)}
                      disabled={!canWrite || restore.isPending || destroy.isPending}
                      aria-label={`Seleccionar ${d.name}`}
                    />
                  </td>
                  <td className="px-4 py-4 align-top"><p className="font-medium leading-5 text-ink-900 [overflow-wrap:anywhere]">{d.name}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-steel-600"><span className="rounded border border-steel-200 bg-steel-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase">{d.format}</span><span className="tabular-nums">{fmtSize(d.sizeBytes)}</span></div></td>
                  <td className="px-4 py-4 align-top text-xs tnum text-steel-700"><time dateTime={d.deletedAt}>{new Date(d.deletedAt).toLocaleDateString('es-CL')}<span className="mt-1 block text-steel-600">{new Date(d.deletedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span></time></td>
                  <td className="px-4 py-4 align-top">
                    {!canWrite ? null : confirmId === d.id ? (
                      <div className="flex flex-wrap items-center justify-center gap-2 text-center">
                        <span className="w-full text-xs text-rose-600 font-medium">¿Eliminar definitivamente?</span>
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
                      <div className="flex flex-wrap items-center justify-center gap-2">
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
    </div>
  );
}
