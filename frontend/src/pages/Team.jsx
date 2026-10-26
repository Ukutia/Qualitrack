import { useState } from 'react';
import { useAddTeamMember, useTeamMembers } from '../hooks/useApi.js';
import { ROLES, roleLabel } from '../lib/roles.js';

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

export default function Team() {
  const members = useTeamMembers();
  const addMember = useAddTeamMember();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [result, setResult] = useState(null);

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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
