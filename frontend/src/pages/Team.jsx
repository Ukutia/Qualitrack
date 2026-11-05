import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageSizeSelect, PaginationFooter, TableSearch } from '../components/TableControls.jsx';
import { useAddTeamMember, useDeleteTeamMember, useTeamMembers } from '../hooks/useApi.js';
import { ROLES, roleLabel } from '../lib/roles.js';

const EMPTY = { email: '', nombre: '', cargo: '', rol: ROLES.USER };
const ROLE_OPTIONS = [ROLES.USER, ROLES.INGESTOR, ROLES.ADMIN];

const inputClasses = (hasError) =>
  `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-steel-400 ${
    hasError ? 'border-red-400 focus:border-red-500' : 'border-steel-300 focus:border-brand-500'
  }`;

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('es-CL') : '—';
}

function normalized(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-CL');
}

function Field({ id, label, error, children }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-ink-900">{label}</label>
      {children}
      {error && <p id={`${id}-error`} className="text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
      <path d="m13.5 7.5 3 3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
    </svg>
  );
}

export default function Team() {
  const members = useTeamMembers();
  const addMember = useAddTeamMember();
  const deleteMember = useDeleteTeamMember();
  const addDialog = useRef(null);
  const deleteDialog = useRef(null);
  const listTable = useRef(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [result, setResult] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteStatus, setDeleteStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  function update(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  function openAdd() {
    setErrors({});
    setFormError('');
    setResult(null);
    queueMicrotask(() => addDialog.current?.showModal());
  }

  function closeAdd() {
    if (addMember.isPending) return;
    addDialog.current?.close();
    setForm(EMPTY);
    setErrors({});
    setFormError('');
    setResult(null);
  }

  async function submit(event) {
    event.preventDefault();
    setErrors({});
    setFormError('');
    setResult(null);
    try {
      const data = await addMember.mutateAsync(form);
      setResult(data);
      setForm(EMPTY);
    } catch (error) {
      const body = error?.response?.data;
      if (body?.errors) setErrors(body.errors);
      setFormError(body?.error || 'No fue posible incorporar a la persona.');
    }
  }

  function openDelete(member) {
    setDeleteTarget(member);
    setDeleteConfirmation('');
    setDeleteError('');
    setDeleteStatus('');
    queueMicrotask(() => deleteDialog.current?.showModal());
  }

  function closeDelete() {
    if (deleteMember.isPending) return;
    deleteDialog.current?.close();
    setDeleteTarget(null);
    setDeleteConfirmation('');
    setDeleteError('');
  }

  async function confirmDelete(event) {
    event.preventDefault();
    if (!deleteTarget || deleteConfirmation !== 'entiendo') return;
    setDeleteError('');
    try {
      const data = await deleteMember.mutateAsync({ memberId: deleteTarget.id, confirmation: deleteConfirmation });
      setDeleteStatus(`${data.deleted.name} fue eliminado del equipo. Su acceso quedó revocado y sus registros se conservaron.`);
      deleteDialog.current?.close();
      setDeleteTarget(null);
      setDeleteConfirmation('');
    } catch (error) {
      setDeleteError(error?.response?.data?.error || 'No fue posible eliminar al integrante.');
    }
  }

  const fieldProps = (field) => ({
    id: `team-${field}`,
    value: form[field],
    onChange: update(field),
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': errors[field] ? `team-${field}-error` : undefined,
    className: inputClasses(Boolean(errors[field])),
  });

  const allMembers = members.data ?? [];
  const needle = normalized(search.trim());
  const filteredMembers = needle
    ? allMembers.filter((member) => normalized([member.name, member.email, member.cargo, roleLabel(member.role), formatDate(member.createdAt)].join(' ')).includes(needle))
    : allMembers;
  const pages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visibleMembers = filteredMembers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [currentPage, page]);

  function goToPage(value) {
    setPage(value);
    listTable.current?.scrollIntoView({ block: 'start' });
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">Equipo</h1>
          <p className="mt-2 text-sm text-steel-500">Integrantes que actualmente tienen acceso a Qualitrack.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/team/permissions"
            aria-label="Editar permisos por módulo"
            title="Editar permisos por módulo"
            data-onboarding-key="editar-permisos"
            data-onboarding-order="60"
            className="inline-grid h-11 w-11 place-items-center rounded-full border border-steel-300 bg-white text-brand-700 shadow-soft transition-colors hover:border-brand-300 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
          >
            <PencilIcon />
          </Link>
          <button
            type="button"
            onClick={openAdd}
            aria-label="Incorporar integrante"
            title="Incorporar integrante"
            data-onboarding-key="incorporar-equipo"
            data-onboarding-order="40"
            className="btn inline-grid h-11 w-11 place-items-center rounded-full bg-brand-600 text-white shadow-soft hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
          >
            <PlusIcon />
          </button>
        </div>
      </header>

      <section className="space-y-3" aria-labelledby="team-members-title">
        <h2 id="team-members-title" className="sr-only">Integrantes actuales</h2>
        {deleteStatus && (
          <div role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">{deleteStatus}</div>
        )}
        <div ref={listTable} className="min-w-0 scroll-mt-4 overflow-hidden rounded-xl2 bg-white shadow-soft ring-1 ring-steel-200/70">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-steel-100 px-5 py-4">
            <TableSearch id="team-search" label="Buscar integrantes" placeholder="Buscar por nombre, correo, cargo o rol…" value={search} onChange={(value) => { setSearch(value); setPage(1); }} onboardingKey="buscar-integrantes" onboardingOrder={10} />
            <PageSizeSelect value={pageSize} onChange={(value) => { setPageSize(value); setPage(1); }} onboardingKey="filas-equipo" onboardingOrder={20} />
            <p aria-live="polite" className="w-full text-sm font-medium text-steel-700">
              {members.isLoading ? 'Cargando integrantes…' : members.isError ? 'Equipo no disponible' : `Mostrando ${visibleMembers.length} de ${filteredMembers.length} integrantes`}
            </p>
          </div>

          {members.isError ? (
            <div role="alert" className="px-6 py-12 text-center text-sm text-red-700">No fue posible cargar el equipo.</div>
          ) : members.isLoading ? (
            <div className="p-8 text-center text-sm text-steel-500">Cargando integrantes…</div>
          ) : visibleMembers.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <h3 className="font-display text-lg font-semibold text-ink-900">{search ? 'Sin coincidencias' : 'Aún no hay integrantes'}</h3>
              <p className="mt-2 text-sm text-steel-600">{search ? 'Prueba con otro nombre, correo, cargo o rol.' : 'Los integrantes aparecerán aquí cuando sean incorporados.'}</p>
            </div>
          ) : (
            <div role="region" aria-label="Tabla de integrantes, desplazable horizontalmente" tabIndex={0} className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-steel-200 text-xs uppercase tracking-wide text-steel-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Nombre</th>
                    <th className="px-5 py-3 font-medium">Correo</th>
                    <th className="px-5 py-3 font-medium">Cargo</th>
                    <th className="px-5 py-3 font-medium">Rol</th>
                    <th className="px-5 py-3 font-medium">Incorporación</th>
                    <th className="px-5 py-3 text-center font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-steel-100">
                  {visibleMembers.map((member) => (
                    <tr key={member.id}>
                      <td className="px-5 py-3 font-medium text-ink-900">{member.name}</td>
                      <td className="px-5 py-3 text-steel-700">{member.email}</td>
                      <td className="px-5 py-3 text-steel-700">{member.cargo}</td>
                      <td className="px-5 py-3 text-steel-700">{roleLabel(member.role)}</td>
                      <td className="px-5 py-3 text-steel-500">{formatDate(member.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {member.role === ROLES.ADMIN ? (
                            <span className="text-xs text-steel-400">Acceso total</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openDelete(member)}
                              aria-label={`Eliminar a ${member.name}`}
                              title={`Eliminar a ${member.name}`}
                              data-onboarding-key="eliminar-integrante"
                              data-onboarding-order="50"
                              className="inline-grid h-9 w-9 place-items-center rounded-lg text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-400"
                            >
                              <TrashIcon />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!members.isLoading && !members.isError && (
            <PaginationFooter page={currentPage} pages={pages} pageSize={pageSize} total={filteredMembers.length} itemLabel="integrantes" ariaLabel="Paginación del equipo" onPageChange={goToPage} onboardingKeys={{ previous: 'pagina-anterior-equipo', page: 'ir-pagina-equipo', next: 'pagina-siguiente-equipo' }} onboardingOrder={30} />
          )}
        </div>
      </section>

      <dialog
        ref={addDialog}
        aria-labelledby="add-member-title"
        onCancel={(event) => {
          if (addMember.isPending) event.preventDefault();
          else closeAdd();
        }}
        className="w-[min(92vw,42rem)] rounded-xl2 bg-white p-0 text-ink-900 shadow-2xl backdrop:bg-ink-950/45"
      >
        <form noValidate onSubmit={submit} className="p-6">
          <h2 id="add-member-title" data-onboarding-key="formulario-integrante" data-onboarding-order="70" className="font-display text-2xl font-semibold">Incorporar integrante</h2>
          <p className="mt-2 text-sm leading-6 text-steel-600">El acceso se concede de inmediato con el rol elegido y se notifica por correo.</p>

          {formError && <div role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{formError}</div>}
          {result && (
            <div role="status" className={`mt-5 rounded-lg px-4 py-3 text-sm ring-1 ${result.notification.sent ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-amber-200'}`}>
              <p className="font-medium">{result.member.name} ya tiene acceso como {roleLabel(result.member.role)}.</p>
              {result.notification.sent ? (
                <p className="mt-1">Se envió la notificación a {result.member.email}.</p>
              ) : (
                <>
                  <p className="mt-1">{result.notification.error}</p>
                  <p className="mt-1">Entrega esta contraseña temporal por un canal seguro; no volverá a mostrarse: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-ink-900 ring-1 ring-amber-200">{result.notification.temporaryPassword}</code></p>
                </>
              )}
            </div>
          )}

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field id="team-email" label="Correo" error={errors.email}>
              <input type="email" maxLength={254} autoComplete="off" placeholder="nombre@institucion.cl" data-onboarding-key="correo-integrante" data-onboarding-order="71" {...fieldProps('email')} />
            </Field>
            <Field id="team-nombre" label="Nombre" error={errors.nombre}>
              <input type="text" maxLength={100} autoComplete="off" placeholder="María José Peña" data-onboarding-key="nombre-integrante" data-onboarding-order="72" {...fieldProps('nombre')} />
            </Field>
            <Field id="team-cargo" label="Cargo" error={errors.cargo}>
              <input type="text" maxLength={100} autoComplete="off" placeholder="Analista de Calidad" data-onboarding-key="cargo-integrante" data-onboarding-order="73" {...fieldProps('cargo')} />
            </Field>
            <Field id="team-rol" label="Rol a asignar" error={errors.rol}>
              <select aria-label="Rol a asignar" data-onboarding-key="rol-integrante" data-onboarding-order="74" {...fieldProps('rol')}>
                {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
              </select>
            </Field>
          </div>
          <p className="mt-4 text-xs text-steel-500">Nombre y cargo solo admiten letras (incluidas tildes y ñ) y espacios.</p>

          <div className="mt-6 flex justify-end gap-3 border-t border-steel-200 pt-5">
            <button type="button" onClick={closeAdd} disabled={addMember.isPending} data-onboarding-key="cancelar-incorporacion" data-onboarding-order="76" className="rounded-lg border border-steel-300 px-4 py-2.5 text-sm font-medium text-steel-700 hover:bg-steel-50 disabled:opacity-50">{result ? 'Cerrar' : 'Cancelar'}</button>
            <button type="submit" disabled={addMember.isPending} data-onboarding-key="confirmar-incorporacion" data-onboarding-order="75" className="btn rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{addMember.isPending ? 'Incorporando…' : 'Incorporar al equipo'}</button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={deleteDialog}
        aria-labelledby="delete-member-title"
        onCancel={(event) => {
          if (deleteMember.isPending) event.preventDefault();
          else closeDelete();
        }}
        className="w-[min(92vw,32rem)] rounded-xl2 bg-white p-0 text-ink-900 shadow-2xl backdrop:bg-ink-950/45"
      >
        {deleteTarget && (
          <form onSubmit={confirmDelete} className="p-6">
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-700"><TrashIcon /></div>
              <div>
                <h2 id="delete-member-title" className="font-display text-xl font-semibold">Eliminar integrante</h2>
                <p className="mt-2 text-sm leading-6 text-steel-600">Se revocará inmediatamente el acceso de <strong className="text-ink-900">{deleteTarget.name}</strong> ({deleteTarget.email}) y desaparecerá del equipo. Sus documentos, carpetas y registros históricos se conservarán.</p>
              </div>
            </div>

            <label htmlFor="delete-member-confirmation" className="mt-5 block text-sm font-medium text-ink-900">Para confirmar, escriba <span className="font-mono font-semibold">entiendo</span></label>
            <input
              id="delete-member-confirmation"
              autoFocus
              autoComplete="off"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              className="mt-2 w-full rounded-lg border border-steel-300 px-3 py-2.5 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
            {deleteError && <p role="alert" className="mt-3 text-sm text-rose-700">{deleteError}</p>}

            <div className="mt-6 flex justify-end gap-3 border-t border-steel-200 pt-5">
              <button type="button" onClick={closeDelete} disabled={deleteMember.isPending} className="rounded-lg border border-steel-300 px-4 py-2.5 text-sm font-medium text-steel-700 hover:bg-steel-50 disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={deleteConfirmation !== 'entiendo' || deleteMember.isPending} className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40">{deleteMember.isPending ? 'Eliminando…' : 'Eliminar integrante'}</button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
