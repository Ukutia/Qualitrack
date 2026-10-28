import { useRef, useState } from 'react';
import { useAddTeamMember, useDeleteTeamMember, useTeamMembers, useUpdateMemberPermission } from '../hooks/useApi.js';
import { ROLES, roleLabel } from '../lib/roles.js';
import { LEVELS, LEVEL_LABELS, MODULES, MODULE_LABELS } from '../lib/permissions.js';

// HU18 — El Encargado de Aseguramiento de la Calidad incorpora personas al
// equipo. El backend valida cada campo y devuelve { errors: { campo: mensaje } };
// acá solo se muestran junto al input que corresponde.

const EMPTY = { email: '', nombre: '', cargo: '', rol: ROLES.USER };
const ROLE_OPTIONS = [ROLES.USER, ROLES.INGESTOR, ROLES.ADMIN];

const inputClasses = (hasError) =>
  `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-steel-400 ${
    hasError ? 'border-red-400 focus:border-red-500' : 'border-steel-300 focus:border-brand-500'
  }`;

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('es-CL') : '—';
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

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
    </svg>
  );
}

const LEVEL_OPTIONS = [LEVELS.LECTURA, LEVELS.ESCRITURA, LEVELS.DENEGADO];
const LEVEL_STYLES = {
  [LEVELS.ESCRITURA]: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  [LEVELS.LECTURA]: 'border-sky-300 bg-sky-50 text-sky-800',
  [LEVELS.DENEGADO]: 'border-rose-300 bg-rose-50 text-rose-800',
};

// HU19 — Matriz integrante × módulo. Cada selector guarda al cambiar y la celda
// muestra lo que respondió el backend, así la vista siempre es la vigente.
function PermissionMatrix({ members }) {
  const update = useUpdateMemberPermission();
  const [status, setStatus] = useState(null);
  const editable = members.filter((m) => m.role !== ROLES.ADMIN);
  const pendingKey = update.isPending ? `${update.variables.memberId}:${update.variables.module}` : null;

  async function change(member, module, level) {
    setStatus(null);
    try {
      await update.mutateAsync({ memberId: member.id, module, level });
      const text = level === LEVELS.DENEGADO
        ? `Guardado: ${member.name} ya no tiene acceso a ${MODULE_LABELS[module]}.`
        : `Guardado: ${member.name} tiene ${LEVEL_LABELS[level].toLowerCase()} en ${MODULE_LABELS[module]}.`;
      setStatus({ ok: true, text });
    } catch (error) {
      setStatus({ ok: false, text: error?.response?.data?.error || 'No fue posible guardar el permiso.' });
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">Permisos por módulo</h2>
        <p className="mt-1 text-sm text-steel-500">
          Personaliza qué puede hacer cada integrante. Lo marcado «según rol» aún no se ha personalizado y sigue la plantilla de su rol. Los administradores acceden a todo.
        </p>
      </div>
      {status && (
        <div role={status.ok ? 'status' : 'alert'} className={`rounded-lg px-4 py-3 text-sm ring-1 ${status.ok ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-red-50 text-red-700 ring-red-200'}`}>
          {status.text}
        </div>
      )}
      {editable.length === 0 ? (
        <div className="rounded-xl2 bg-white p-8 text-center text-sm text-steel-500 shadow-soft">Aún no hay integrantes con permisos personalizables.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl2 bg-white shadow-soft ring-1 ring-steel-200/70">
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
              {editable.map((member) => (
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
    </section>
  );
}

export default function Team() {
  const members = useTeamMembers();
  const addMember = useAddTeamMember();
  const deleteMember = useDeleteTeamMember();
  const deleteDialog = useRef(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [result, setResult] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteStatus, setDeleteStatus] = useState('');

  function update(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    };
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
      const data = await deleteMember.mutateAsync({
        memberId: deleteTarget.id,
        confirmation: deleteConfirmation,
      });
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">Equipo</h1>
        <p className="mt-2 text-sm text-steel-500">
          Incorpora personas al equipo. El acceso se concede de inmediato con el rol elegido y se notifica por correo, sin requerir aceptación.
        </p>
      </header>

      <form noValidate onSubmit={submit} className="space-y-5 rounded-xl2 bg-white p-6 shadow-soft ring-1 ring-steel-200/70">
        {formError && <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{formError}</div>}
        {result && (
          <div role="status" className={`rounded-lg px-4 py-3 text-sm ring-1 ${result.notification.sent ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-amber-200'}`}>
            <p className="font-medium">{result.member.name} ya tiene acceso como {roleLabel(result.member.role)}.</p>
            {result.notification.sent ? (
              <p className="mt-1">Se envió la notificación a {result.member.email}.</p>
            ) : (
              <>
                <p className="mt-1">{result.notification.error}</p>
                <p className="mt-1">
                  Entrega esta contraseña temporal por un canal seguro; no volverá a mostrarse:{' '}
                  <code className="rounded bg-white px-1.5 py-0.5 font-mono text-ink-900 ring-1 ring-amber-200">{result.notification.temporaryPassword}</code>
                </p>
              </>
            )}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="team-email" label="Correo" error={errors.email}>
            <input type="email" maxLength={254} autoComplete="off" placeholder="nombre@institucion.cl" {...fieldProps('email')} />
          </Field>
          <Field id="team-nombre" label="Nombre" error={errors.nombre}>
            <input type="text" maxLength={100} autoComplete="off" placeholder="María José Peña" {...fieldProps('nombre')} />
          </Field>
          <Field id="team-cargo" label="Cargo" error={errors.cargo}>
            <input type="text" maxLength={100} autoComplete="off" placeholder="Analista de Calidad" {...fieldProps('cargo')} />
          </Field>
          <Field id="team-rol" label="Rol a asignar" error={errors.rol}>
            <select {...fieldProps('rol')}>
              {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
            </select>
          </Field>
        </div>
        <p className="text-xs text-steel-500">Nombre y cargo solo admiten letras (incluidas tildes y ñ) y espacios.</p>

        <div className="border-t border-steel-200 pt-5">
          <button type="submit" disabled={addMember.isPending} className="btn rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {addMember.isPending ? 'Incorporando…' : 'Incorporar al equipo'}
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink-900">Integrantes</h2>
        {deleteStatus && (
          <div role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
            {deleteStatus}
          </div>
        )}
        {members.isLoading ? (
          <div className="rounded-xl2 bg-white p-8 text-center text-sm text-steel-500 shadow-soft">Cargando integrantes…</div>
        ) : members.isError ? (
          <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">No fue posible cargar el equipo.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl2 bg-white shadow-soft ring-1 ring-steel-200/70">
            <table className="w-full text-left text-sm">
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
                {members.data.map((member) => (
                  <tr key={member.id}>
                    <td className="px-5 py-3 font-medium text-ink-900">{member.name}</td>
                    <td className="px-5 py-3 text-steel-700">{member.email}</td>
                    <td className="px-5 py-3 text-steel-700">{member.cargo}</td>
                    <td className="px-5 py-3 text-steel-700">{roleLabel(member.role)}</td>
                    <td className="px-5 py-3 text-steel-500">{formatDate(member.createdAt)}</td>
                    <td className="px-5 py-3 text-center">
                      {member.role === ROLES.ADMIN ? (
                        <span className="text-xs text-steel-400">No disponible</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openDelete(member)}
                          aria-label={`Eliminar a ${member.name}`}
                          title={`Eliminar a ${member.name}`}
                          className="inline-grid h-9 w-9 place-items-center rounded-lg text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-400"
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {members.data && <PermissionMatrix members={members.data} />}

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
                <p className="mt-2 text-sm leading-6 text-steel-600">
                  Se revocará inmediatamente el acceso de <strong className="text-ink-900">{deleteTarget.name}</strong> ({deleteTarget.email}) y desaparecerá del equipo. Sus documentos, carpetas y registros históricos se conservarán.
                </p>
              </div>
            </div>

            <label htmlFor="delete-member-confirmation" className="mt-5 block text-sm font-medium text-ink-900">
              Para confirmar, escriba <span className="font-mono font-semibold">entiendo</span>
            </label>
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
              <button type="button" onClick={closeDelete} disabled={deleteMember.isPending} className="rounded-lg border border-steel-300 px-4 py-2.5 text-sm font-medium text-steel-700 hover:bg-steel-50 disabled:opacity-50">
                Cancelar
              </button>
              <button type="submit" disabled={deleteConfirmation !== 'entiendo' || deleteMember.isPending} className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40">
                {deleteMember.isPending ? 'Eliminando…' : 'Eliminar integrante'}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
