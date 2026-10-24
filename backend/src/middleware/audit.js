import { recordSecurityEvent } from '../services/audit.service.js';

export function sensitiveAction(method, path) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return null;
  const resource = path.split('/')[1];
  if (!['documents', 'associations', 'document-requests', 'report-drafts', 'report-structure', 'cloud'].includes(resource)) return null;
  const operation = path.split('/').filter(Boolean).filter((part) => !/^\d+$/.test(part)).join('_').toUpperCase().replaceAll('-', '_');
  return `${operation}_${method}`;
}

// Persist before the response is sent. A failed audit write must be visible,
// not silently disappear. Domain services can use recordSecurityEvent(tx).
export function auditRequests(req, res, next) {
  const json = res.json.bind(res);
  const send = res.send.bind(res);
  let intercepted = false;
  const respond = (original, body) => {
    if (intercepted) return original(body);
    intercepted = true;
    const denied = res.statusCode === 403;
    const action = denied ? 'ACCESS_DENIED' : sensitiveAction(req.method, req.path);
    if (!req.user || !action) return original(body);
    const resourceId = req.params?.id ?? (res.statusCode < 300 ? body?.id ?? body?.document?.id ?? body?.request?.id : null);
    recordSecurityEvent({ user: req.user, action,
      resourceType: denied ? `${req.method} ${req.path}` : req.path.split('/')[1], resourceId,
      result: denied ? 'DENIED' : res.statusCode >= 400 ? 'FAILURE' : 'SUCCESS',
    }).then(() => original(body)).catch(next);
    return res;
  };
  res.json = (body) => respond(json, body);
  res.send = (body) => respond(send, body);
  next();
}
