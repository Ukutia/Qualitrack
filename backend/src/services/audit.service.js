import { prisma } from '../config/prisma.js';

// Deliberately allowlisted: never persist request bodies, passwords or tokens.
export function recordSecurityEvent({ user, action, resourceType, resourceId, result = 'SUCCESS' }, db = prisma) {
  return db.securityEvent.create({ data: {
    actorId: user?.id ?? null,
    actorEmail: user?.email ?? null,
    action, resourceType, resourceId: resourceId == null ? null : String(resourceId), result,
  } });
}

// The request to classify is asynchronous. Record its final outcome separately
// using the account referenced by the authenticated worker, never its payload.
export async function recordClassificationOutcome({ userId, documentId, status }, db = prisma) {
  if (!['COMPLETED', 'ERROR'].includes(status)) return;
  const id = Number(userId);
  const validId = Number.isSafeInteger(id) && id > 0;
  const user = validId
    ? await db.user.findUnique({ where: { id }, select: { id: true, email: true } })
    : null;
  await recordSecurityEvent({ user: user || (validId ? { id } : null),
    action: status === 'COMPLETED' ? 'CLASSIFICATION_COMPLETED' : 'CLASSIFICATION_FAILED',
    resourceType: 'documents', resourceId: documentId, result: status === 'COMPLETED' ? 'SUCCESS' : 'FAILURE',
  }, db);
}
