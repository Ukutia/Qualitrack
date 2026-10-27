import { prisma } from '../config/prisma.js';
import { allows } from '../config/permissions.js';
import { loadPermissions } from '../middleware/authorize.js';
import { recordSecurityEvent } from '../services/audit.service.js';

// The UI prevents mounting forbidden sections. Validate the matching API
// permission on the server before recording the navigation attempt.
const sections = {
  '/app': '/compliance', '/documents': '/documents', '/requests': '/document-requests',
  '/search': '/topics/network', '/structure': '/report-structure', '/report': '/report-drafts',
  '/cloud': '/cloud/google/status', '/trash': '/documents/trash', '/milestones': '/milestones',
};
export async function recordDeniedNavigation(req, res) {
  const section = req.body?.section;
  const root = typeof section === 'string' ? `/${section.split('/')[1]}` : '';
  if (typeof section !== 'string' || section.length > 200 || !/^\/[a-z0-9/-]+$/.test(section) || !Object.hasOwn(sections, root) || allows(await loadPermissions(req.user), 'GET', sections[root])) return res.status(400).json({ error: 'Sección no denegada.' });
  await recordSecurityEvent({ user: req.user, action: 'ACCESS_DENIED', resourceType: 'section', resourceId: section, result: 'DENIED' });
  res.status(204).send();
}

export async function listSecurityEvents(req, res) {
  const page = Math.min(1000000, Math.max(1, Math.trunc(Number(req.query.page)) || 1));
  const where = req.query.result === 'DENIED' ? { result: 'DENIED' } : {};
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
