import { prisma } from '../config/prisma.js';
import { recordSecurityEvent } from '../services/audit.service.js';
import { milestoneColor, validateMilestone, todayInChile, WARNING_DAYS, MILESTONE_TIME_ZONE } from '../services/milestones.service.js';

const include = { responsible: { select: { id: true, name: true } }, completedBy: { select: { id: true, name: true } }, tasks: { orderBy: { id: 'asc' } } };
const serialize = (hito) => ({ ...hito, color: milestoneColor(hito) });
const allowed = (hito, user) => user.role === 'admin' || hito.responsibleId === user.id;

export async function listMilestones(req, res) {
  const items = await prisma.milestone.findMany({ include, orderBy: [{ dueDate: 'asc' }, { id: 'asc' }] });
  res.json({ items: items.map(serialize), today: todayInChile(), warningDays: WARNING_DAYS, timeZone: MILESTONE_TIME_ZONE });
}

export async function milestoneResponsibles(req, res) {
  res.json({ items: await prisma.user.findMany({ where: { role: { in: ['admin', 'user'] } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) });
}

export async function saveMilestone(req, res) {
  const { data, errors } = validateMilestone(req.body || {});
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Revise los campos indicados.', fields: errors });
  const id = req.params.id ? Number(req.params.id) : null;
  const outcome = await prisma.$transaction(async (tx) => {
    if (id) {
      await tx.$queryRaw`SELECT "id" FROM "Milestone" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.milestone.findUnique({ where: { id } });
      if (!current) return { status: 404, error: 'Hito no encontrado.' };
      if (!allowed(current, req.user)) return { status: 403, error: 'Acceso Denegado' };
      if (current.completedAt) return { status: 409, error: 'El hito ya está completado.' };
    }
    const responsible = await tx.user.findUnique({ where: { id: data.responsibleId }, select: { role: true } });
    if (!responsible || !['admin', 'user'].includes(responsible.role)) return { status: 400, error: 'Revise la persona responsable.', fields: { responsibleId: 'La persona debe tener acceso al tablero de hitos.' } };
    const { tasks, ...fields } = data;
    const item = id
      ? await tx.milestone.update({ where: { id }, data: { ...fields, tasks: { deleteMany: {}, create: tasks.map((title) => ({ title })) } }, include })
      : await tx.milestone.create({ data: { ...fields, createdById: req.user.id, tasks: { create: tasks.map((title) => ({ title })) } }, include });
    await recordSecurityEvent({ user: req.user, action: id ? 'MILESTONE_UPDATED' : 'MILESTONE_CREATED', resourceType: 'milestone', resourceId: item.id }, tx);
    return { item };
  });
  if (outcome.error) return res.status(outcome.status).json(outcome);
  req.auditRecorded = true;
  res.status(id ? 200 : 201).json(serialize(outcome.item));
}

export async function completeMilestone(req, res) {
  const id = Number(req.params.id);
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Milestone" WHERE "id" = ${id} FOR UPDATE`;
    const item = await tx.milestone.findUnique({ where: { id } });
    if (!item) return { status: 404, error: 'Hito no encontrado.' };
    if (!allowed(item, req.user)) return { status: 403, error: 'Acceso Denegado' };
    if (item.completedAt) return { status: 409, error: 'El hito ya está completado.' };
    const updated = await tx.milestone.updateMany({ where: { id, completedAt: null, ...(req.user.role === 'admin' ? {} : { responsibleId: req.user.id }) }, data: { completedAt: new Date(), completedById: req.user.id } });
    if (!updated.count) return { status: 409, error: 'El hito cambió; actualice la vista.' };
    await recordSecurityEvent({ user: req.user, action: 'MILESTONE_COMPLETED', resourceType: 'milestone', resourceId: id }, tx);
    return { item: await tx.milestone.findUnique({ where: { id }, include }) };
  });
  if (outcome.error) return res.status(outcome.status).json(outcome);
  req.auditRecorded = true;
  res.json(serialize(outcome.item));
}
