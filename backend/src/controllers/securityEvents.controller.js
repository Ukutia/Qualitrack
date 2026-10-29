import { prisma } from '../config/prisma.js';
import { allows } from '../config/permissions.js';
import { loadPermissions } from '../middleware/authorize.js';
import { recordSecurityEvent } from '../services/audit.service.js';
import { ROLES } from '../config/roles.js';

// The UI prevents mounting forbidden sections. Validate the matching API
// permission on the server before recording the navigation attempt.
const sections = {
  '/app': ['GET', '/compliance'], '/documents': ['GET', '/documents'], '/requests': ['GET', '/document-requests'],
  '/requests/new': ['POST', '/document-requests'], '/upload': ['POST', '/documents'],
  '/search': ['GET', '/topics/network'], '/structure': ['GET', '/report-structure'], '/report': ['GET', '/report-drafts'],
  '/cloud': ['GET', '/cloud/google/status'], '/trash': ['GET', '/documents/trash'], '/milestones': ['GET', '/milestones'],
  '/security-events': ['GET', '/security-events'], '/team': ['GET', '/team/members'],
};
export async function recordDeniedNavigation(req, res) {
  const section = req.body?.section;
  const root = typeof section === 'string' ? `/${section.split('/')[1]}` : '';
  // Match the same operation the UI guards: creating a request or uploading
  // needs writing, even when that account can read the corresponding module.
  const operation = sections[section] ?? sections[root];
  if (typeof section !== 'string' || section.length > 200 || !/^\/[a-z0-9/-]+$/.test(section) || !operation || req.user.role === ROLES.ADMIN || allows(await loadPermissions(req.user), ...operation)) return res.status(400).json({ error: 'Sección no denegada.' });
  await recordSecurityEvent({ user: req.user, action: 'ACCESS_DENIED', resourceType: 'section', resourceId: section, result: 'DENIED' });
  res.status(204).send();
}

export async function listSecurityEvents(req, res) {
  const page = Math.min(1000000, Math.max(1, Math.trunc(Number(req.query.page)) || 1));
  const where = req.query.result === 'DENIED' ? { result: 'DENIED' } : {};
  if (req.query.category === 'authentication') {
    where.action = { in: ['LOGIN', 'LOGIN_FAILED', 'LOGIN_INVALID_PASSWORD', 'LOGIN_UNKNOWN_ACCOUNT', 'LOGIN_MISSING_CREDENTIALS', 'LOGIN_BLOCKED', 'ACCOUNT_LOCKED'] };
  } else if (req.query.category === 'locks') {
    where.action = 'ACCOUNT_LOCKED';
  }
  const requestedSize = Number(req.query.pageSize);
  const pageSize = [10, 25, 50].includes(requestedSize) ? requestedSize : 50;
  const result = await prisma.$transaction(async (tx) => {
    const total = await tx.securityEvent.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const items = await tx.securityEvent.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (currentPage - 1) * pageSize, take: pageSize });
    return { items, total, page: currentPage, pageSize, totalPages };
  });
  res.json(result);
}
