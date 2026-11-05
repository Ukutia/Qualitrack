import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageSizeSelect, PaginationFooter, TableSearch } from '../components/TableControls.jsx';
import { useTeamMembers, useUpdateMemberPermission } from '../hooks/useApi.js';
import { ROLES, roleLabel } from '../lib/roles.js';
import { LEVELS, LEVEL_LABELS, MODULES, MODULE_LABELS } from '../lib/permissions.js';

const LEVEL_OPTIONS = [LEVELS.LECTURA, LEVELS.ESCRITURA, LEVELS.DENEGADO];
const LEVEL_STYLES = {
  [LEVELS.ESCRITURA]: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  [LEVELS.LECTURA]: 'border-sky-300 bg-sky-50 text-sky-800',
  [LEVELS.DENEGADO]: 'border-rose-300 bg-rose-50 text-rose-800',
};

function ArrowLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function normalized(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-CL');
}

export default function TeamPermissions() {
  const members = useTeamMembers();
  const update = useUpdateMemberPermission();
  const permissionsTable = useRef(null);
  const [status, setStatus] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pendingKey = update.isPending
    ? `${update.variables?.memberId}:${update.variables?.module}`
    : null;

  async function change(member, module, level) {
    setStatus(null);
    try {
      await update.mutateAsync({ memberId: member.id, module, level });
      const text = level === LEVELS.DENEGADO
        ? `${member.name} ya no tiene acceso a ${MODULE_LABELS[module]}.`
        : `${member.name} tiene ${LEVEL_LABELS[level].toLowerCase()} en ${MODULE_LABELS[module]}.`;
      setStatus({ ok: true, text: `Permiso guardado. ${text}` });
    } catch (error) {
      setStatus({ ok: false, text: error?.response?.data?.error || 'No fue posible guardar el permiso.' });
    }
  }

  const editable = members.data?.filter((member) => member.role !== ROLES.ADMIN) ?? [];
  const needle = normalized(search.trim());
  const filteredMembers = needle
    ? editable.filter((member) => normalized([member.name, member.email, member.cargo, roleLabel(member.role)].join(' ')).includes(needle))
    : editable;
  const pages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visibleMembers = filteredMembers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [currentPage, page]);

  function goToPage(value) {
    setPage(value);
    permissionsTable.current?.scrollIntoView({ block: 'start' });
  }

  return (
    <div className="space-y-6">
      <header>
        <Link to="/team" data-onboarding-key="volver-equipo" data-onboarding-order="50" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
          <ArrowLeftIcon />
          Volver al equipo
        </Link>
        <div className="mt-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">Permisos por módulo</h1>
          <p className="mt-2 text-sm text-steel-500">
            Personaliza qué puede hacer cada integrante. Lo marcado «según rol» aún no se ha personalizado y sigue la plantilla de su rol. Los administradores acceden a todo.
          </p>
        </div>
      </header>

      {status && (
        <div role={status.ok ? 'status' : 'alert'} className={`rounded-lg px-4 py-3 text-sm ring-1 ${status.ok ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-red-50 text-red-700 ring-red-200'}`}>
          {status.text}
        </div>
      )}

      <section ref={permissionsTable} className="min-w-0 scroll-mt-4 overflow-hidden rounded-xl2 bg-white shadow-soft ring-1 ring-steel-200/70" aria-label="Permisos de los integrantes por módulo">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-steel-100 px-5 py-4">
          <TableSearch id="permissions-search" label="Buscar integrantes en permisos" placeholder="Buscar por nombre, correo, cargo o rol…" value={search} onChange={(value) => { setSearch(value); setPage(1); }} onboardingKey="buscar-permisos" onboardingOrder={10} />
          <PageSizeSelect value={pageSize} onChange={(value) => { setPageSize(value); setPage(1); }} onboardingKey="filas-permisos" onboardingOrder={20} />
          <p aria-live="polite" className="w-full text-sm font-medium text-steel-700">
            {members.isLoading ? 'Cargando permisos…' : members.isError ? 'Permisos no disponibles' : `Mostrando ${visibleMembers.length} de ${filteredMembers.length} integrantes`}
          </p>
        </div>

        {members.isError ? (
          <div role="alert" className="px-6 py-12 text-center text-sm text-red-700">No fue posible cargar los permisos del equipo.</div>
        ) : members.isLoading ? (
          <div className="p-8 text-center text-sm text-steel-500">Cargando permisos…</div>
        ) : visibleMembers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <h2 className="font-display text-lg font-semibold text-ink-900">{search ? 'Sin coincidencias' : 'Sin permisos personalizables'}</h2>
            <p className="mt-2 text-sm text-steel-600">{search ? 'Prueba con otro nombre, correo, cargo o rol.' : 'Aún no hay integrantes con permisos personalizables.'}</p>
          </div>
        ) : (
          <div role="region" aria-label="Tabla de permisos, desplazable horizontalmente" tabIndex={0} className="overflow-x-auto overscroll-x-contain">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-steel-200 text-xs uppercase tracking-wide text-steel-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Integrante</th>
                  {Object.values(MODULES).map((module) => (
                    <th key={module} className="px-2 py-3 font-medium">{MODULE_LABELS[module]}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-100">
                {visibleMembers.map((member) => (
                  <tr key={member.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-900">{member.name}</p>
                      <p className="text-xs text-steel-500">{roleLabel(member.role)}</p>
                    </td>
                    {member.permissions.map((permission) => {
                      const key = `${member.id}:${permission.module}`;
                      return (
                        <td key={permission.module} className="px-2 py-3 align-top">
                          <select
                            aria-label={`${MODULE_LABELS[permission.module]} para ${member.name}`}
                            data-onboarding-key="nivel-permiso"
                            data-onboarding-order="30"
                            value={permission.level}
                            disabled={pendingKey === key}
                            onChange={(event) => change(member, permission.module, event.target.value)}
                            className={`w-full min-w-[7.5rem] rounded-lg border px-2 py-1.5 text-xs font-medium disabled:opacity-50 ${LEVEL_STYLES[permission.level]}`}
                          >
                            {LEVEL_OPTIONS.map((level) => <option key={level} value={level}>{LEVEL_LABELS[level]}</option>)}
                          </select>
                          <p className="mt-1 text-[11px] text-steel-500">
                            {pendingKey === key ? 'Guardando…' : permission.source === 'personalizado' ? 'Personalizado' : 'Según rol'}
                          </p>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!members.isLoading && !members.isError && (
          <PaginationFooter page={currentPage} pages={pages} pageSize={pageSize} total={filteredMembers.length} itemLabel="integrantes" ariaLabel="Paginación de permisos" onPageChange={goToPage} onboardingKeys={{ previous: 'pagina-anterior-permisos', page: 'ir-pagina-permisos', next: 'pagina-siguiente-permisos' }} onboardingOrder={40} />
        )}
      </section>
    </div>
  );
}
