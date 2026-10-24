import { prisma } from '../config/prisma.js';

// Deliberately allowlisted: never persist request bodies, passwords or tokens.
export function recordSecurityEvent({ user, action, resourceType, resourceId, result = 'SUCCESS' }, db = prisma) {
  return db.securityEvent.create({ data: {
    actorId: user?.id ?? null,
    actorEmail: user?.email ?? null,
    action, resourceType, resourceId: resourceId == null ? null : String(resourceId), result,
  } });
}
