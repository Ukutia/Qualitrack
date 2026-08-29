// Pertenencia de documentos (EP 1.2).
//
// El rol User solo opera sobre los documentos que él mismo cargó. Intentar
// acceder al documento de otro usuario responde "Acceso denegado" —y no un 404—
// porque el criterio de aceptación pide ese mensaje explícito.
import { prisma } from '../config/prisma.js';
import { isOwnerScoped } from '../config/roles.js';
import { ACCESS_DENIED } from './authorize.js';

const DENIED_DOCUMENT = {
  ...ACCESS_DENIED,
  error: 'Acceso denegado: el documento pertenece a otro usuario.',
};

/** Filtro Prisma que acota un listado de documentos al dueño, salvo admin. */
export function ownerFilter(user) {
  return isOwnerScoped(user.role) ? { uploadedById: user.id } : {};
}

/** Exige que :id sea un documento del usuario (el admin pasa siempre). */
export async function requireOwnDocument(req, res, next) {
  if (!isOwnerScoped(req.user.role)) return next();

  const doc = await prisma.document.findUnique({
    where: { id: Number(req.params.id) },
    select: { uploadedById: true },
  });
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });
  if (doc.uploadedById !== req.user.id) return res.status(403).json(DENIED_DOCUMENT);
  return next();
}

/** Exige que :id sea una asociación de un documento del usuario. */
export async function requireOwnAssociation(req, res, next) {
  if (!isOwnerScoped(req.user.role)) return next();

  const assoc = await prisma.association.findUnique({
    where: { id: Number(req.params.id) },
    select: { document: { select: { uploadedById: true } } },
  });
  if (!assoc) return res.status(404).json({ error: 'Asociación no encontrada.' });
  if (assoc.document.uploadedById !== req.user.id) return res.status(403).json(DENIED_DOCUMENT);
  return next();
}
