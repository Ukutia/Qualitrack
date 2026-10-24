import { beforeEach, describe, expect, it, vi } from 'vitest';
import { milestoneColor, todayInChile, validateMilestone } from '../src/services/milestones.service.js';

vi.mock('../src/config/prisma.js', () => ({ prisma: {
  $transaction: vi.fn(), $queryRaw: vi.fn(), user: { findUnique: vi.fn() },
  milestone: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  securityEvent: { create: vi.fn() },
} }));
const { prisma } = await import('../src/config/prisma.js');
const { saveMilestone, completeMilestone } = await import('../src/controllers/milestones.controller.js');
const res = () => { const value = { statusCode: 200 }; value.status = vi.fn((code) => { value.statusCode = code; return value; }); value.json = vi.fn(() => value); return value; };
const body = () => ({ title: 'Preparar acreditación', dueDate: todayInChile(), responsibleId: 2, tasks: ['Reunir documentos'] });
beforeEach(() => { vi.clearAllMocks(); prisma.$transaction.mockImplementation((fn) => fn(prisma)); });

describe('reglas de fechas de HU24', () => {
  it('usa el día de Chile incluso cerca de medianoche UTC', () => {
    expect(todayInChile(new Date('2026-10-24T01:00:00Z'))).toBe('2026-10-23');
  });
  it('evalúa gris, amarillo, rojo y completado sin depender de las tareas', () => {
    const color = (dueDate, completedAt) => milestoneColor({ dueDate, completedAt, tasks: [{ completed: false }] }, '2026-10-24');
    expect(color('2026-11-01')).toBe('gray');
    expect(color('2026-10-31')).toBe('yellow');
    expect(color('2026-10-24')).toBe('yellow');
    expect(color('2026-10-23')).toBe('red');
    expect(color('2026-10-23', new Date())).toBe('green');
  });
  it('rechaza fechas inexistentes y reporta todos los campos inválidos', () => {
    const result = validateMilestone({ title: '', dueDate: '2026-02-30', responsibleId: 0, tasks: [''] }, '2026-01-01');
    expect(Object.keys(result.errors).sort()).toEqual(['dueDate', 'responsibleId', 'tasks', 'title']);
    expect(validateMilestone({ ...body(), title: 'a'.repeat(100) }).errors).toEqual({});
    expect(validateMilestone({ ...body(), title: 'a'.repeat(101) }).errors.title).toBeTruthy();
    expect(validateMilestone({ ...body(), dueDate: '2020-01-01' }).errors.dueDate).toBeTruthy();
  });
});

describe('operaciones de hitos', () => {
  it('no escribe hitos ni tareas con campos inválidos', async () => {
    const response = res();
    await saveMilestone({ body: { ...body(), title: '' }, params: {}, user: { id: 1, role: 'user' } }, response);
    expect(response.statusCode).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.milestone.create).not.toHaveBeenCalled();
  });
  it('rechaza un responsable sin acceso y no guarda nada', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ingestor' });
    const response = res();
    await saveMilestone({ body: body(), params: {}, user: { id: 1, role: 'user' } }, response);
    expect(response.statusCode).toBe(400);
    expect(prisma.milestone.create).not.toHaveBeenCalled();
    expect(prisma.securityEvent.create).not.toHaveBeenCalled();
  });
  it('guarda las tareas y la auditoría en la misma transacción', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'user' });
    prisma.milestone.create.mockResolvedValue({ id: 7, ...body(), completedAt: null });
    const response = res();
    await saveMilestone({ body: body(), params: {}, user: { id: 1, email: 'user@test.cl', role: 'user' } }, response);
    expect(response.statusCode).toBe(201);
    expect(prisma.milestone.create.mock.calls[0][0].data.tasks).toEqual({ create: [{ title: 'Reunir documentos' }] });
    expect(prisma.securityEvent.create.mock.calls[0][0].data).toMatchObject({ action: 'MILESTONE_CREATED', actorId: 1, resourceId: '7' });
  });
  it('deniega completar un hito ajeno', async () => {
    prisma.milestone.findUnique.mockResolvedValue({ id: 7, responsibleId: 2 });
    const response = res();
    await completeMilestone({ params: { id: '7' }, user: { id: 3, role: 'user' } }, response);
    expect(response.statusCode).toBe(403);
    expect(prisma.milestone.updateMany).not.toHaveBeenCalled();
  });
  it.each([{ id: 2, role: 'user' }, { id: 3, role: 'admin' }])('permite completar al responsable o administrador: %j', async (user) => {
    prisma.milestone.findUnique.mockResolvedValue({ id: 7, responsibleId: 2, dueDate: todayInChile(), completedAt: null });
    prisma.milestone.updateMany.mockResolvedValue({ count: 1 });
    const response = res();
    await completeMilestone({ params: { id: '7' }, user }, response);
    expect(response.statusCode).toBe(200);
    expect(prisma.milestone.updateMany.mock.calls[0][0].data).toMatchObject({ completedById: user.id, completedAt: expect.any(Date) });
    expect(prisma.securityEvent.create.mock.calls[0][0].data.action).toBe('MILESTONE_COMPLETED');
  });
  it('no sobrescribe la autoría de un hito completado', async () => {
    prisma.milestone.findUnique.mockResolvedValue({ id: 7, responsibleId: 2, completedAt: new Date() });
    const response = res();
    await completeMilestone({ params: { id: '7' }, user: { id: 2, role: 'user' } }, response);
    expect(response.statusCode).toBe(409);
    expect(prisma.milestone.updateMany).not.toHaveBeenCalled();
  });
});
