import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const labels = { gray: 'En plazo', yellow: 'Próximo a vencer', red: 'Vencido', green: 'Completado' };
const colors = { gray: 'bg-steel-100 text-steel-600', yellow: 'bg-amber-100 text-amber-800', red: 'bg-rose-100 text-rose-800', green: 'bg-emerald-100 text-emerald-800' };
const empty = { title: '', dueDate: '', responsibleId: '', tasks: '' };
const accents = { gray: 'bg-steel-400', yellow: 'bg-amber-400', red: 'bg-rose-500', green: 'bg-emerald-500' };
const statusGroups = [['gray', 'En plazo'], ['yellow', 'Por vencer'], ['red', 'Vencidos'], ['green', 'Completados']];

function deadlineLabel(item, today) {
  if (item.completedAt) return 'Proceso finalizado';
  if (!today) return 'Fecha límite';
  const days = Math.round((Date.parse(item.dueDate) - Date.parse(today)) / 86400000);
  return days < 0 ? `${Math.abs(days)} día${days === -1 ? '' : 's'} de atraso` : days === 0 ? 'Vence hoy' : days === 1 ? 'Vence mañana' : `Faltan ${days} días`;
}

export default function Milestones({ panel = false }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(!panel);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [fields, setFields] = useState({});
  const [filter, setFilter] = useState('all');
  const dialog = useRef(null);
  const trigger = useRef(null);
  const query = useQuery({ queryKey: ['milestones'], queryFn: async () => (await api.get('/milestones')).data, refetchInterval: 60000 });
  const responsibles = useQuery({ queryKey: ['milestone-responsibles'], queryFn: async () => (await api.get('/milestones/responsibles')).data, enabled: open });
  useEffect(() => {
    if (!panel || !open) return;
    const element = dialog.current;
    const main = element?.closest('main');
    const previousMainOverflow = main?.style.overflow;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (main) main.style.overflow = 'hidden';
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (main) main.style.overflow = previousMainOverflow;
    };
  }, [panel, open]);
  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, responsibleId: Number(form.responsibleId), tasks: form.tasks.split('\n').filter((t) => t.trim()) };
      return editing ? api.put(`/milestones/${editing}`, payload) : api.post('/milestones', payload);
    },
    onSuccess: () => { client.invalidateQueries({ queryKey: ['milestones'] }); setForm(empty); setEditing(null); setFields({}); if (panel) close(); },
    onError: (error) => setFields(error.response?.data?.fields || {}),
  });
  const complete = useMutation({ mutationFn: (id) => api.post(`/milestones/${id}/complete`), onSuccess: () => client.invalidateQueries({ queryKey: ['milestones'] }) });
  function close() { setOpen(false); trigger.current?.focus(); }
  function edit(item) {
    setEditing(item.id); setFields({}); save.reset();
    setForm({ title: item.title, dueDate: item.dueDate, responsibleId: String(item.responsibleId), tasks: item.tasks.map((t) => t.title).join('\n') });
    setOpen(true);
  }
  function create() { setEditing(null); setForm(empty); setFields({}); save.reset(); setOpen(true); }
  const input = 'mt-1 w-full rounded-lg border border-steel-200 p-2 text-sm';
  const content = <>
    <header className="flex items-center justify-between gap-3">
      <h2 id="milestones-title" className="font-display text-2xl font-semibold">{editing ? 'Modificar hito' : 'Registrar hito'}</h2>
      {panel && <button type="button" onClick={close} aria-label="Cerrar hitos" className="rounded-lg border px-3 py-2">Cerrar</button>}
    </header>
    <p className="mt-2 text-sm text-steel-500">Seguimiento por fecha límite. Próximo a vencer: hasta {query.data?.warningDays ?? 7} días. Fechas según Chile.</p>
    <form className="my-5 space-y-3 rounded-xl border border-steel-200 bg-white p-4" onSubmit={(e) => { e.preventDefault(); setFields({}); save.mutate(); }}>
      <label className="block text-sm">Título<input autoFocus className={input} value={form.title} maxLength={100} required aria-invalid={!!fields.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />{fields.title && <span className="text-rose-700">{fields.title}</span>}</label>
      <label className="block text-sm">Fecha límite<input className={input} type="date" required min={query.data?.today} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />{fields.dueDate && <span className="text-rose-700">{fields.dueDate}</span>}</label>
      <label className="block text-sm">Responsable<select required className={input} value={form.responsibleId} onChange={(e) => setForm({ ...form, responsibleId: e.target.value })}><option value="">Seleccione una persona</option>{responsibles.data?.items.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>{fields.responsibleId && <span className="text-rose-700">{fields.responsibleId}</span>}</label>
      {responsibles.isError && <p role="alert" className="text-sm text-rose-700">No se pudieron cargar las personas responsables.</p>}
      <label className="block text-sm">Tareas (una por línea)<textarea className={input} rows={3} value={form.tasks} onChange={(e) => setForm({ ...form, tasks: e.target.value })} />{fields.tasks && <span className="text-rose-700">{fields.tasks}</span>}</label>
      {save.isError && <p role="alert" className="text-sm text-rose-700">{save.error.response?.data?.error || 'No se pudo guardar el hito.'}</p>}
      <button disabled={save.isPending} className="rounded-lg bg-ink-900 px-4 py-2 text-white disabled:opacity-50">{save.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar hito'}</button>
      {editing && <button type="button" className="ml-3 text-sm underline" onClick={() => { setEditing(null); setForm(empty); setFields({}); save.reset(); }}>Cancelar edición</button>}
      {save.isSuccess && <p role="status" className="text-sm text-emerald-700">Hito guardado.</p>}
    </form>
  </>;
  const tracking = <>
    {query.isPending && <p role="status">Cargando hitos…</p>}
    {query.isError && <p role="alert">No se pudieron cargar los hitos. <button onClick={() => query.refetch()} className="underline">Reintentar</button></p>}
    {complete.isError && <p role="alert" className="text-rose-700">{complete.error.response?.data?.error || 'No se pudo completar el hito.'}</p>}
    {query.data && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{statusGroups.map(([color, label]) => <button key={color} type="button" aria-pressed={filter === color} onClick={() => setFilter(filter === color ? 'all' : color)} className={`rounded-xl border bg-white p-4 text-left transition-shadow hover:shadow-soft ${filter === color ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-steel-200/70'}`}>
        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-steel-500"><span className={`h-2 w-2 rounded-full ${accents[color]}`} />{label}</span>
        <span className="mt-2 block text-3xl font-semibold tabular-nums text-ink-900">{query.data.items.filter((item) => item.color === color).length}</span>
      </button>)}</div>
      <div className="flex items-center justify-between text-sm"><p className="text-steel-500">{filter === 'all' ? 'Todos los hitos' : labels[filter]}</p>{filter !== 'all' && <button onClick={() => setFilter('all')} className="font-medium text-brand-600">Ver todos</button>}</div>
      {query.data.items.length === 0 && <div className="rounded-xl2 border-2 border-dashed border-steel-200 bg-white/60 px-6 py-12 text-center"><span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-2xl text-brand-600" aria-hidden="true">⚑</span><h3 className="font-display text-xl font-semibold text-ink-900">Cada avance empieza con un hito</h3><p className="mt-2 text-sm text-steel-500">Registra el primero para organizar fechas, responsables y tareas.</p></div>}
      {query.data.items.length > 0 && !query.data.items.some((item) => filter === 'all' || item.color === filter) && <p className="rounded-xl border border-steel-200 bg-white p-6 text-sm text-steel-500">No hay hitos con este estado.</p>}
    </>}
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{query.data?.items.filter((item) => filter === 'all' || item.color === filter).map((item) => <article key={item.id} className="relative flex min-w-0 flex-col overflow-hidden break-words rounded-xl2 bg-white shadow-soft ring-1 ring-steel-200/70 transition-shadow hover:shadow-lift">
      <div className={`h-1.5 ${accents[item.color]}`} />
      <div className="flex flex-1 flex-col p-5">
      <div className="mb-4 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-steel-400">Hito #{item.id}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${colors[item.color]}`}>{labels[item.color]}</span></div>
      <h3 className="min-w-0 font-display text-lg font-semibold leading-snug text-ink-900">{item.title}</h3>
      <div className="my-4 rounded-lg bg-steel-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-steel-400">Fecha límite</p><p className="mt-1 text-lg font-semibold tabular-nums text-ink-900">{item.dueDate.split('-').reverse().join('/')}</p><p className={`mt-1 text-xs font-medium ${item.color === 'red' ? 'text-rose-600' : item.color === 'yellow' ? 'text-amber-700' : 'text-steel-500'}`}>{deadlineLabel(item, query.data.today)}</p></div>
      <div className="mb-4 flex items-center gap-2.5"><span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{item.responsible.name.split(' ').filter(Boolean).slice(0, 2).map((name) => name[0]).join('').toLocaleUpperCase('es-CL')}</span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wider text-steel-400">Responsable</p><p className="text-sm font-medium text-steel-700">{item.responsible.name}</p></div></div>
      <details className="mb-4 text-sm text-steel-600"><summary className="cursor-pointer font-medium">{item.tasks.length} tarea{item.tasks.length === 1 ? '' : 's'} asociada{item.tasks.length === 1 ? '' : 's'}</summary>{item.tasks.length > 0 ? <ul className="mt-2 list-disc space-y-1 pl-5">{item.tasks.map((task) => <li key={task.id}>{task.title}</li>)}</ul> : <p className="mt-2 text-xs text-steel-400">Sin tareas asociadas.</p>}</details>
      <div className="mt-auto border-t border-steel-100 pt-3">
      {item.completedAt ? <p className="mt-2 text-xs text-steel-500">Completado por {item.completedBy?.name} el {new Date(item.completedAt).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}.</p> : (user.role === 'admin' || item.responsibleId === user.id) && <div className="mt-3 flex gap-4 text-sm"><button className="underline" onClick={() => edit(item)}>Modificar</button><button disabled={complete.isPending} className="font-semibold text-emerald-700 disabled:opacity-50" onClick={() => complete.mutate(item.id)}>Marcar completado</button></div>}
      </div></div>
    </article>)}</div>
  </>;
  if (!panel) return <section>{content}{tracking}</section>;
  return <><section aria-labelledby="milestones-tracking-title" className="space-y-4">
    <header className="relative flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-xl2 border border-brand-200/70 bg-gradient-to-br from-brand-100 via-brand-50 to-paper p-6 text-ink-900">
      <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-gold-200/40 blur-2xl" />
      <div className="relative"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-700">Ruta de acreditación</p><h2 id="milestones-tracking-title" className="font-display text-2xl font-semibold">Los próximos pasos, a la vista</h2><p className="mt-2 max-w-md text-sm text-steel-700">Organiza fechas, coordina responsables y sigue cada avance del proceso.</p></div>
      <button ref={trigger} onClick={create} aria-haspopup="dialog" className="relative rounded-lg border border-brand-200 bg-white/90 px-4 py-3 text-sm font-semibold text-brand-800 shadow-soft transition-colors hover:bg-brand-50">+ Registrar hito</button>
    </header>
    {save.isSuccess && <p role="status" className="text-sm text-emerald-700">Hito guardado.</p>}
    {tracking}
  </section>
    {open && <dialog ref={dialog} onCancel={close} onClose={() => setOpen(false)} aria-labelledby="milestones-title" className="milestone-drawer"><div className="milestone-drawer-content">{content}</div></dialog>}
  </>;
}
