export const WARNING_DAYS = 7;
export const MILESTONE_TIME_ZONE = 'America/Santiago';

export function todayInChile(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: MILESTONE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function milestoneColor(hito, today = todayInChile()) {
  if (hito.completedAt) return 'green';
  const days = (Date.parse(hito.dueDate.slice(0, 10)) - Date.parse(today)) / 86400000;
  return days < 0 ? 'red' : days <= WARNING_DAYS ? 'yellow' : 'gray';
}

export function validateMilestone(body, today = todayInChile()) {
  const errors = {};
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || [...title].length > 100) errors.title = 'El título debe tener entre 1 y 100 caracteres.';
  const dueDate = body.dueDate;
  if (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(Date.parse(dueDate)) || new Date(dueDate).toISOString().slice(0, 10) !== dueDate || dueDate < today)
    errors.dueDate = 'La fecha límite debe ser válida e igual o posterior al día actual de Chile.';
  if (!Number.isInteger(body.responsibleId) || body.responsibleId < 1) errors.responsibleId = 'Seleccione una persona responsable con acceso a los hitos.';
  const tasks = body.tasks ?? [];
  if (!Array.isArray(tasks) || tasks.length > 100 || tasks.some((t) => typeof t !== 'string' || !t.trim() || [...t.trim()].length > 200))
    errors.tasks = 'Ingrese hasta 100 tareas con títulos de entre 1 y 200 caracteres.';
  return { errors, data: { title, dueDate, responsibleId: body.responsibleId, tasks: Array.isArray(tasks) ? tasks.map((t) => typeof t === 'string' ? t.trim() : t) : [] } };
}
