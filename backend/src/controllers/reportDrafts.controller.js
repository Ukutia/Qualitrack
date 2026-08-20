// Redacción del informe — borradores editados dentro de la plataforma.
// El autoguardado del editor pega contra PUT /report-drafts/:id, que responde
// con la hora de la versión almacenada para que la UI la muestre.
import { prisma } from '../config/prisma.js';
import {
  sanitizeDraftHtml,
  htmlToPlainText,
  normalizeDraftTitle,
  MAX_DRAFT_HTML_BYTES,
} from '../services/draftSanitizer.service.js';

const PREVIEW_CHARS = 180;

function toSummary(draft) {
  return {
    id: draft.id,
    title: draft.title,
    preview: draft.contentText.slice(0, PREVIEW_CHARS),
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

/** GET /report-drafts — borradores del usuario, del más reciente al más antiguo. */
export async function listDrafts(req, res) {
  const drafts = await prisma.reportDraft.findMany({
    where: { authorId: req.user.id },
    orderBy: { updatedAt: 'desc' },
  });
  return res.json(drafts.map(toSummary));
}

/** POST /report-drafts — abre un borrador nuevo, vacío. */
export async function createDraft(req, res) {
  const title = normalizeDraftTitle(req.body?.title);
  const contentHtml = sanitizeDraftHtml(req.body?.contentHtml);

  const draft = await prisma.reportDraft.create({
    data: {
      title,
      contentHtml,
      contentText: htmlToPlainText(contentHtml),
      authorId: req.user.id,
    },
  });
  return res.status(201).json(draft);
}

/** GET /report-drafts/:id — contenido íntegro para reabrir el borrador. */
export async function getDraft(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });

  const draft = await prisma.reportDraft.findFirst({
    where: { id, authorId: req.user.id },
  });
  if (!draft) return res.status(404).json({ error: 'Borrador no encontrado.' });

  return res.json(draft);
}

/** PUT /report-drafts/:id — guardado (manual o automático) del borrador. */
export async function updateDraft(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });

  const existing = await prisma.reportDraft.findFirst({
    where: { id, authorId: req.user.id },
    select: { id: true, title: true },
  });
  if (!existing) return res.status(404).json({ error: 'Borrador no encontrado.' });

  const data = {};

  if (req.body?.title !== undefined) {
    data.title = normalizeDraftTitle(req.body.title, existing.title);
  }

  if (req.body?.contentHtml !== undefined) {
    if (typeof req.body.contentHtml !== 'string') {
      return res.status(400).json({ error: 'El contenido del borrador debe ser texto.' });
    }
    if (Buffer.byteLength(req.body.contentHtml, 'utf8') > MAX_DRAFT_HTML_BYTES) {
      return res.status(413).json({ error: 'El borrador excede el tamaño máximo permitido.' });
    }
    data.contentHtml = sanitizeDraftHtml(req.body.contentHtml);
    data.contentText = htmlToPlainText(data.contentHtml);
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No se recibieron cambios.' });
  }

  const draft = await prisma.reportDraft.update({ where: { id }, data });
  return res.json({
    id: draft.id,
    title: draft.title,
    updatedAt: draft.updatedAt,
  });
}

/** DELETE /report-drafts/:id — elimina un borrador propio. */
export async function deleteDraft(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });

  const { count } = await prisma.reportDraft.deleteMany({
    where: { id, authorId: req.user.id },
  });
  if (count === 0) return res.status(404).json({ error: 'Borrador no encontrado.' });

  return res.status(204).end();
}
