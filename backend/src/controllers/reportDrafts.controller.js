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

// Intervalo mínimo entre instantáneas automáticas: el autoguardado pega cada
// pocos segundos y no cada cambio merece quedar en el historial.
const MIN_VERSION_INTERVAL_MS = 5 * 60 * 1000;

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

  const contentChanged =
    data.contentHtml !== undefined && data.contentHtml !== existing.contentHtml;

  const draft = await prisma.$transaction(async (tx) => {
    if (contentChanged) await snapshotIfDue(tx, existing, req.user.id);
    return tx.reportDraft.update({ where: { id }, data });
  });

  return res.json({
    id: draft.id,
    title: draft.title,
    updatedAt: draft.updatedAt,
  });
}

/** Respalda el estado previo del borrador si pasó el intervalo mínimo desde la última instantánea. */
async function snapshotIfDue(tx, draft, userId) {
  const last = await tx.reportDraftVersion.findFirst({
    where: { draftId: draft.id },
    orderBy: { version: 'desc' },
  });
  if (last && Date.now() - last.createdAt.getTime() < MIN_VERSION_INTERVAL_MS) return;

  await tx.reportDraftVersion.create({
    data: {
      draftId: draft.id,
      version: (last?.version || 0) + 1,
      title: draft.title,
      contentHtml: draft.contentHtml,
      contentText: draft.contentText,
      createdById: userId,
    },
  });
}

/** GET /report-drafts/:id/history — instantáneas guardadas, de más reciente a más antigua. */
export async function getDraftHistory(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });

  const draft = await prisma.reportDraft.findFirst({
    where: { id, authorId: req.user.id },
    select: { id: true },
  });
  if (!draft) return res.status(404).json({ error: 'Borrador no encontrado.' });

  const versions = await prisma.reportDraftVersion.findMany({
    where: { draftId: id },
    orderBy: { version: 'desc' },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });

  return res.json(
    versions.map((v) => ({
      version: v.version,
      title: v.title,
      preview: v.contentText.slice(0, PREVIEW_CHARS),
      createdAt: v.createdAt,
      createdBy: v.createdBy
        ? { id: v.createdBy.id, name: v.createdBy.name, email: v.createdBy.email }
        : null,
    }))
  );
}

/**
 * POST /report-drafts/:id/versions/:version/restore
 * Respalda el estado actual (si difiere) y aplica el contenido de la
 * instantánea indicada al borrador vigente.
 */
export async function restoreDraftVersion(req, res) {
  const id = Number(req.params.id);
  const targetVersion = Number(req.params.version);
  if (!Number.isInteger(id) || !Number.isInteger(targetVersion)) {
    return res.status(400).json({ error: 'Identificador o versión inválidos.' });
  }

  const draft = await prisma.reportDraft.findFirst({ where: { id, authorId: req.user.id } });
  if (!draft) return res.status(404).json({ error: 'Borrador no encontrado.' });

  const target = await prisma.reportDraftVersion.findUnique({
    where: { draftId_version: { draftId: id, version: targetVersion } },
  });
  if (!target) return res.status(404).json({ error: `Versión ${targetVersion} no encontrada.` });

  const restored = await prisma.$transaction(async (tx) => {
    if (draft.contentHtml !== target.contentHtml || draft.title !== target.title) {
      const last = await tx.reportDraftVersion.findFirst({
        where: { draftId: id },
        orderBy: { version: 'desc' },
      });
      await tx.reportDraftVersion.create({
        data: {
          draftId: id,
          version: (last?.version || 0) + 1,
          title: draft.title,
          contentHtml: draft.contentHtml,
          contentText: draft.contentText,
          createdById: req.user.id,
        },
      });
    }

    return tx.reportDraft.update({
      where: { id },
      data: {
        title: target.title,
        contentHtml: target.contentHtml,
        contentText: target.contentText,
      },
    });
  });

  return res.json({
    id: restored.id,
    title: restored.title,
    contentHtml: restored.contentHtml,
    updatedAt: restored.updatedAt,
    restoredFrom: targetVersion,
    message: `Borrador restaurado a la versión ${targetVersion}.`,
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
