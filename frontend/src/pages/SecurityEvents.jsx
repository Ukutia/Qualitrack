import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const ACTION_LABELS = {
  LOGIN: 'Inicio de sesión', LOGIN_FAILED: 'Inicio de sesión fallido', ACCOUNT_LOCKED: 'Bloqueo temporal de cuenta', ACCESS_DENIED: 'Acceso denegado',
  TEAM_MEMBER_DELETED: 'Eliminación de integrante',
  MILESTONE_CREATED: 'Hito registrado', MILESTONE_UPDATED: 'Hito modificado', MILESTONE_COMPLETED: 'Hito completado',
  DOCUMENTS_POST: 'Carga de evidencia', DOCUMENTS_DELETE: 'Eliminación de evidencia', DOCUMENTS_TRASH_POST: 'Envío a papelera', DOCUMENTS_RESTORE_POST: 'Restauración de evidencia',
  DOCUMENTS_CLASSIFY_POST: 'Clasificación de evidencia', DOCUMENTS_CLASSIFY_FALLBACK_POST: 'Clasificación de respaldo', DOCUMENTS_ASSOCIATION_PUT: 'Reasignación de evidencia',
  ASSOCIATIONS_VALIDATE_POST: 'Validación de clasificación', ASSOCIATIONS_REJECT_POST: 'Rechazo de clasificación',
  DOCUMENT_REQUESTS_POST: 'Creación de solicitud', DOCUMENT_REQUESTS_PAUSE_POST: 'Pausa de solicitud', DOCUMENT_REQUESTS_RESUME_POST: 'Reanudación de solicitud', DOCUMENT_REQUESTS_CANCEL_POST: 'Cancelación de solicitud', DOCUMENT_REQUESTS_DELETE: 'Eliminación de solicitud',
  REPORT_DRAFTS_POST: 'Creación de borrador', REPORT_DRAFTS_PUT: 'Modificación del informe', REPORT_DRAFTS_DELETE: 'Eliminación de borrador', REPORT_DRAFTS_SECTIONS_PUT: 'Modificación de sección', REPORT_STRUCTURE_POST: 'Actualización de estructura',
  CLOUD_GOOGLE_IMPORT_POST: 'Importación desde Google Drive', CLOUD_DROPBOX_IMPORT_POST: 'Importación desde Dropbox',
};
const RESOURCES = { account: 'Cuenta', milestone: 'Hito', documents: 'Evidencia', associations: 'Clasificación', 'document-requests': 'Solicitud', 'report-drafts': 'Informe', 'report-structure': 'Estructura del informe', cloud: 'Conexión de nube', section: 'Sección', 'team-member': 'Integrante' };
const RESULTS = {
  SUCCESS: { label: 'Correcto', classes: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500' },
  FAILURE: { label: 'Fallido', classes: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  DENIED: { label: 'Denegado', classes: 'bg-rose-50 text-rose-800 ring-rose-200', dot: 'bg-rose-500' },
};

function actionLabel(action) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (action.startsWith('REPORT_DRAFTS_')) return 'Operación sobre el informe';
  if (action.startsWith('REPORT_STRUCTURE_')) return 'Operación sobre la estructura';
  if (action.startsWith('DOCUMENTS_')) return 'Operación sobre evidencia';
  return action.replaceAll('_', ' ').toLocaleLowerCase('es-CL');
}

function ShieldIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>;
}

export default function SecurityEvents() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const table = useRef(null);
  const [denied, setDenied] = useState(false);
  const query = useQuery({ queryKey: ['security-events', page, pageSize, denied], queryFn: async ({ signal }) => (await api.get('/security-events', { signal, params: { page, pageSize, ...(denied ? { result: 'DENIED' } : {}) } })).data, refetchInterval: 30000 });
  const total = query.data?.total ?? 0;
  const visibleItems = query.data?.items ?? [];
  const pages = query.data?.totalPages ?? Math.max(1, Math.ceil(total / pageSize));
  const pageNumbers = [...new Set([1, ...Array.from({ length: 5 }, (_, i) => page - 2 + i), pages])].filter((value) => value >= 1 && value <= pages).sort((a, b) => a - b);
  useEffect(() => { if (query.data && query.data.page !== page) setPage(query.data.page); }, [query.data, page]);
  function goToPage(value) {
    setPage(value);
    table.current?.scrollIntoView({ block: 'start' });
  }
  return <section className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><div className="mb-3 flex items-center gap-2 text-brand-700"><ShieldIcon /><span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Trazabilidad de la plataforma</span></div><h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">Registro de seguridad</h1><p className="mt-2 max-w-xl text-sm leading-6 text-steel-600">Consulta quién realizó una operación, sobre qué información y con qué resultado.</p></div>
      <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="inline-flex items-center gap-2 rounded-lg border border-steel-200 bg-white px-4 py-2.5 text-sm font-medium text-steel-700 transition-colors hover:bg-brand-50 disabled:opacity-50"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4"><path d="M20 11a8 8 0 0 0-14-5L3 9m0-5v5h5M4 13a8 8 0 0 0 14 5l3-3m0 5v-5h-5" strokeLinecap="round" strokeLinejoin="round" /></svg>{query.isFetching ? 'Actualizando…' : 'Actualizar registro'}</button>
    </header>

    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-steel-200/70">
      <div role="group" aria-label="Filtrar eventos" className="flex gap-6">
        {[[false, 'Todos los eventos'], [true, 'Accesos denegados']].map(([value, label]) => <button type="button" key={label} aria-pressed={denied === value} onClick={() => { setDenied(value); setPage(1); }} className={`-mb-px border-b-2 px-1 pb-3 pt-1 text-sm font-medium transition-colors ${denied === value ? value ? 'border-rose-500 text-rose-700' : 'border-brand-600 text-brand-700' : 'border-transparent text-steel-600 hover:text-ink-900'}`}>{label}</button>)}
      </div>
      <span className="mb-3 flex items-center gap-2 text-xs text-steel-600"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-500" />Actualización cada 30 s · Horario UTC</span>
    </div>

    <div ref={table} className="min-w-0 scroll-mt-4 overflow-hidden rounded-xl2 bg-white shadow-soft ring-1 ring-steel-200/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-steel-100 px-5 py-4"><p aria-live="polite" className="text-sm font-medium text-steel-700">{query.isPending ? 'Cargando eventos…' : query.isError ? 'Registro no disponible' : `Mostrando ${visibleItems.length} de ${total} eventos${denied ? ' denegados' : ''}`}</p><label className="flex items-center gap-2 text-xs text-steel-600">Filas por página<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="rounded-lg border border-steel-200 bg-white px-2 py-1.5 text-steel-700">{[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}</select></label></div>
      {query.isError ? <div role="alert" className="px-6 py-12 text-center"><p className="text-sm text-rose-700">No se pudo cargar el registro.</p><button onClick={() => query.refetch()} className="mt-3 text-sm font-medium text-brand-700 underline">Reintentar</button></div> : <>
        <div role="region" aria-label="Tabla del registro de seguridad, desplazable horizontalmente" tabIndex={0} className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[960px] table-fixed text-left text-sm">
            <caption className="sr-only">Registro de accesos y operaciones sensibles, con fecha y hora UTC.</caption>
            <colgroup><col className="w-36" /><col /><col className="w-56" /><col className="w-44" /><col className="w-36" /></colgroup>
            <thead className="bg-steel-50/80 text-steel-500 text-left"><tr>{['Fecha · UTC', 'Cuenta', 'Actividad', 'Información afectada', 'Resultado'].map((title) => <th scope="col" className={`px-4 py-3.5 font-sans text-xs font-semibold uppercase tracking-wide ${title === 'Resultado' ? 'text-center' : ''}`} key={title}>{title}</th>)}</tr></thead>
            <tbody className="divide-y divide-steel-100">
              {query.isPending ? Array.from({ length: 5 }, (_, row) => <tr key={row} aria-hidden="true">{Array.from({ length: 5 }, (_, col) => <td key={col} className="px-4 py-5"><div className="skeleton h-4 w-full" /><div className="skeleton mt-2 h-3 w-2/3" /></td>)}</tr>) : visibleItems.map((event) => {
                const result = RESULTS[event.result] || { label: event.result, classes: 'bg-steel-50 text-steel-700 ring-steel-200', dot: 'bg-steel-400' };
                const date = new Date(event.createdAt);
                return <tr key={event.id} className={`transition-colors ${event.result === 'DENIED' ? 'bg-rose-50/60 hover:bg-rose-50' : 'hover:bg-brand-50/30'}`}>
                  <td className={`border-l-2 px-4 py-4 align-top ${event.result === 'DENIED' ? 'border-rose-400' : 'border-transparent'}`}><time dateTime={event.createdAt} className="text-xs tabular-nums text-steel-700">{date.toLocaleDateString('es-CL', { timeZone: 'UTC' })}<span className="mt-1 block text-steel-600">{date.toLocaleTimeString('es-CL', { timeZone: 'UTC', hour12: false })}</span></time></td>
                  <td className="px-4 py-4 align-top"><p className="font-medium text-steel-800 [overflow-wrap:anywhere]">{event.actorEmail || 'Cuenta no identificada'}</p><p className="mt-1 text-xs text-steel-600">{event.actorId != null ? `Cuenta #${event.actorId}` : 'Sin identificador de cuenta'}</p></td>
                  <td className="px-4 py-4 align-top"><p className={`font-medium leading-5 ${event.result === 'DENIED' ? 'text-rose-800' : 'text-ink-900'}`}>{actionLabel(event.action)}</p><details className="mt-2 text-xs text-steel-600"><summary className="cursor-pointer hover:text-brand-700">Detalles técnicos</summary><dl className="mt-2 space-y-1 rounded-md bg-steel-50 p-2 text-[11px] [overflow-wrap:anywhere]"><dt className="font-medium">Evento #{event.id}</dt><dd>{event.action}</dd><dt className="font-medium">Recurso</dt><dd>{event.resourceType}{event.resourceId ? ` · ${event.resourceId}` : ''}</dd><dt className="font-medium">Fecha UTC</dt><dd>{date.toISOString()}</dd></dl></details></td>
                  <td className="px-4 py-4 align-top text-xs leading-5 text-steel-700"><p className="font-medium [overflow-wrap:anywhere]">{RESOURCES[event.resourceType] || (/^(GET|POST|PUT|PATCH|DELETE) /.test(event.resourceType) ? 'Operación restringida' : event.resourceType)}</p>{event.resourceId && <p className="mt-1 text-steel-600 [overflow-wrap:anywhere]">{event.resourceId.startsWith('/') ? event.resourceId : `#${event.resourceId}`}</p>}</td>
                  <td className="px-4 py-4 text-center align-top"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${result.classes}`}><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${result.dot}`} />{result.label}</span></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        {!query.isPending && !query.data?.items.length && <div className="px-6 py-12 text-center"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><ShieldIcon /></div><h2 className="font-display text-lg font-semibold text-ink-900">{denied ? 'Sin accesos denegados registrados' : 'Todavía no hay eventos'}</h2><p className="mt-2 text-sm text-steel-600">{denied ? 'Puedes consultar el resto de la actividad en Todos los eventos.' : 'Los accesos y operaciones aparecerán aquí a medida que se registren.'}</p></div>}
      </>}
      {query.data && !query.isError && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-steel-100 px-5 py-4 text-xs text-steel-600"><span aria-live="polite">{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}` : '0 eventos'} · Página {page} de {pages}</span><nav aria-label="Paginación del registro de seguridad" className="flex flex-wrap items-center gap-1.5"><button disabled={page === 1 || query.isFetching} onClick={() => goToPage(page - 1)} className="rounded-lg border border-steel-200 px-3 py-2 font-medium text-steel-700 hover:bg-steel-50 disabled:cursor-not-allowed disabled:opacity-40">← Anterior</button>{pageNumbers.map((number, index) => <span key={number} className="inline-flex items-center gap-1.5">{index > 0 && number > pageNumbers[index - 1] + 1 && <span aria-hidden="true" className="px-1">…</span>}<button aria-label={`Ir a la página ${number}`} aria-current={number === page ? 'page' : undefined} disabled={query.isFetching} onClick={() => goToPage(number)} className={`min-w-8 rounded-lg border px-2 py-2 font-medium disabled:opacity-50 ${number === page ? 'border-brand-600 bg-brand-600 text-white' : 'border-steel-200 text-steel-700 hover:bg-steel-50'}`}>{number}</button></span>)}<button disabled={page >= pages || query.isFetching} onClick={() => goToPage(page + 1)} className="rounded-lg border border-steel-200 px-3 py-2 font-medium text-steel-700 hover:bg-steel-50 disabled:cursor-not-allowed disabled:opacity-40">Siguiente →</button></nav></footer>}
    </div>
  </section>;
}
