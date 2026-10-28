import { expect, it, vi } from 'vitest';
import { recordClassificationOutcome } from '../src/services/audit.service.js';
const db = () => ({ user: { findUnique: vi.fn(async () => ({ id: 4, email: 'cuenta@test.cl' })) }, securityEvent: { create: vi.fn(async () => ({})) } });
it.each([['COMPLETED', 'CLASSIFICATION_COMPLETED', 'SUCCESS'], ['ERROR', 'CLASSIFICATION_FAILED', 'FAILURE']])('registra el resultado final %s de la clasificación asíncrona', async (status, action, result) => {
  const tx = db();
  await recordClassificationOutcome({ userId: 4, documentId: 8, status, justification: 'Texto privado', token: 'secreto' }, tx);
  expect(tx.securityEvent.create).toHaveBeenCalledWith({ data: { actorId: 4, actorEmail: 'cuenta@test.cl', action, resourceType: 'documents', resourceId: '8', result } });
});
it('no confunde los estados intermedios con una clasificación terminada', async () => {
  const tx = db();
  await recordClassificationOutcome({ userId: 4, documentId: 8, status: 'ANALYZING_CONTENT' }, tx);
  expect(tx.securityEvent.create).not.toHaveBeenCalled();
});
