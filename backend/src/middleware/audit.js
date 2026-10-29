import { recordSecurityEvent } from '../services/audit.service.js';

export function sensitiveAction(method, path) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return null;
  const resource = path.split('/')[1];
  if (resource === 'team' && /^\/team\/members\/\d+\/permissions$/.test(path)) return 'PERMISSIONS_UPDATED';
  if (!['documents', 'folders', 'associations', 'document-requests', 'report-drafts', 'report-structure', 'cloud', 'milestones'].includes(resource)) return null;
  const operation = path.split('/').filter(Boolean).filter((part) => !/^\d+$/.test(part)).join('_').toUpperCase().replaceAll('-', '_');
  return `${operation}_${method}`;
}

// Persist before the response is sent. A failed audit write must be visible,
// not silently disappear. Domain services can use recordSecurityEvent(tx).
export function auditRequests(req, res, next) {
  const json = res.json.bind(res);
  const send = res.send.bind(res);
  const end = res.end.bind(res);
  let intercepted = false;
  const respond = (original, args) => {
    if (intercepted) return original(...args);
    intercepted = true;
    const denied = res.statusCode === 403;
    const action = denied ? 'ACCESS_DENIED' : sensitiveAction(req.method, req.path);
    if (!req.user || !action || req.auditRecorded) return original(...args);
    const body = args[0];
    // Parameters are not populated yet when the global permission guard rejects.
    const pathIds = req.path.split('/').filter((part) => /^\d+$/.test(part)).join('/');
    const resourceId = pathIds || (res.statusCode < 300 ? body?.id ?? body?.document?.id ?? body?.request?.id : null);
    Promise.resolve().then(() => recordSecurityEvent({ user: req.user, action,
      resourceType: denied ? `${req.method} ${req.path}` : req.path.split('/')[1], resourceId,
      result: denied ? 'DENIED' : res.statusCode >= 400 ? 'FAILURE' : res.statusCode === 202 ? 'ACCEPTED' : 'SUCCESS',
    })).then(() => original(...args)).catch(next);
    return res;
  };
  res.json = (...args) => respond(json, args);
  res.send = (...args) => respond(send, args);
  res.end = (...args) => respond(end, args);
  next();
}
