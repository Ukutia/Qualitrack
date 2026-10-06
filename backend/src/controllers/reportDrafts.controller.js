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
import { viewFilter } from '../middleware/ownership.js';
import { generateReportPreview } from '../services/reportPreview.service.js';
import { detectDocumentIncoherences } from '../services/incoherence.service.js';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from 'docx';
import { parseDocument } from 'htmlparser2';
import { extractText } from '../services/textExtraction.service.js';
import { parseStructureSections } from '../services/structureParser.service.js';
import { parseSectionDescriptions } from '../services/sectionRulesParser.service.js';
import { formatFromName } from '../middleware/upload.js';

const PREVIEW_CHARS = 180;

// Intervalo mínimo entre instantáneas automáticas: el autoguardado pega cada
// pocos segundos y no cada cambio merece quedar en el historial.
const MIN_VERSION_INTERVAL_MS = 5 * 60 * 1000;

function sectionPayload(section, contentHtml = '') {
  return {
    id: section.id,
    structureSectionId: section.structureSectionId,
    code: section.structureSection.code,
    name: section.structureSection.name,
    description: section.structureSection.description,
    parentId: section.structureSection.parentId,
    order: section.structureSection.order,
    required: section.structureSection.required,
    contentHtml,
    contentText: section.contentText,
    updatedAt: section.updatedAt,
  };
}

/** GET /report-drafts/:id/sections — estructura activa + contenido del borrador. */
export async function listDraftSections(req, res) {
  const id = Number(req.params.id);
  const draft = await prisma.reportDraft.findFirst({
    where: { id, authorId: req.user.id },
    select: { id: true, contentHtml: true, contentText: true },
  });
  if (!draft) return res.status(404).json({ error: 'Borrador no encontrado.' });

  const structure = await prisma.reportStructureVersion.findFirst({
    where: { active: true },
    include: { sections: { orderBy: { order: 'asc' } } },
  });
  if (!structure) return res.json({ version: null, sections: [] });

  const saved = await prisma.reportDraftSection.findMany({
    where: { draftId: id },
    include: { structureSection: true },
  });
  const byStructureId = new Map(saved.map((section) => [section.structureSectionId, section]));
  const firstSectionId = structure.sections[0]?.id;

  return res.json({
    version: structure.version,
    sections: structure.sections.map((structureSection) => {
      const stored = byStructureId.get(structureSection.id);
      if (stored) return sectionPayload(stored, stored.contentHtml);
      return {
        id: null,
        structureSectionId: structureSection.id,
        code: structureSection.code,
        name: structureSection.name,
        description: structureSection.description,
        parentId: structureSection.parentId,
        order: structureSection.order,
        required: structureSection.required,
        contentHtml: structureSection.id === firstSectionId ? draft.contentHtml : '',
        contentText: structureSection.id === firstSectionId ? draft.contentText : '',
        updatedAt: null,
      };
    }),
  });
}

/** PUT /report-drafts/:id/sections/:sectionId — guarda una sección concreta. */
export async function updateDraftSection(req, res) {
  const draftId = Number(req.params.id);
  const structureSectionId = Number(req.params.sectionId);
  if (!Number.isInteger(draftId) || !Number.isInteger(structureSectionId)) {
    return res.status(400).json({ error: 'Identificador inválido.' });
  }
  if (typeof req.body?.contentHtml !== 'string') {
    return res.status(400).json({ error: 'El contenido de la sección debe ser texto.' });
  }
  if (Buffer.byteLength(req.body.contentHtml, 'utf8') > MAX_DRAFT_HTML_BYTES) {
    return res.status(413).json({ error: 'La sección excede el tamaño máximo permitido.' });
  }

  const [draft, structureSection] = await Promise.all([
    prisma.reportDraft.findFirst({ where: { id: draftId, authorId: req.user.id }, select: { id: true } }),
    prisma.reportSection.findUnique({ where: { id: structureSectionId } }),
  ]);
  if (!draft) return res.status(404).json({ error: 'Borrador no encontrado.' });
  if (!structureSection) return res.status(404).json({ error: 'Sección no encontrada.' });

  const contentHtml = sanitizeDraftHtml(req.body.contentHtml);
  const contentText = htmlToPlainText(contentHtml);
  const section = await prisma.reportDraftSection.upsert({
    where: { draftId_structureSectionId: { draftId, structureSectionId } },
    create: { draftId, structureSectionId, contentHtml, contentText },
    update: { contentHtml, contentText },
    include: { structureSection: true },
  });

  return res.json({ id: section.id, updatedAt: section.updatedAt, contentHtml: section.contentHtml });
}

function generationSectionPayload(section) {
  return {
    id: section.id,
    code: section.code,
    name: section.name,
    description: section.description,
    requirements: section.requirements,
    contentHtml: section.contentHtml,
    contentText: section.contentText,
    order: section.order,
    updatedAt: section.updatedAt,
  };
}

async function ownDraft(draftId, userId) {
  return prisma.reportDraft.findFirst({ where: { id: draftId, authorId: userId }, select: { id: true } });
}

export async function listGenerationSections(req, res) {
  const draftId = Number(req.params.id);
  if (!(await ownDraft(draftId, req.user.id))) return res.status(404).json({ error: 'Borrador no encontrado.' });
  const sections = await prisma.reportGenerationSection.findMany({ where: { draftId }, orderBy: { order: 'asc' } });
  return res.json({ sections: sections.map(generationSectionPayload) });
}

function generationInput(body, order = 0) {
  const name = String(body?.name || '').trim();
  if (!name) return { error: 'La sección necesita un nombre.' };
  return {
    code: String(body.code || `GEN-${order + 1}`).trim(),
    name,
    description: body.description ? String(body.description).trim() : null,
    requirements: body.requirements && typeof body.requirements === 'object' ? body.requirements : null,
    order: Number.isInteger(body.order) ? body.order : order,
  };
}

export async function createGenerationSection(req, res) {
  const draftId = Number(req.params.id);
  if (!(await ownDraft(draftId, req.user.id))) return res.status(404).json({ error: 'Borrador no encontrado.' });
  const order = await prisma.reportGenerationSection.count({ where: { draftId } });
  const data = generationInput(req.body, order);
  if (data.error) return res.status(400).json({ error: data.error });
  const section = await prisma.reportGenerationSection.create({ data: { ...data, draftId } });
  return res.status(201).json(generationSectionPayload(section));
}

export async function updateGenerationSection(req, res) {
  const id = Number(req.params.sectionId);
  const section = await prisma.reportGenerationSection.findFirst({ where: { id, draft: { authorId: req.user.id } } });
  if (!section) return res.status(404).json({ error: 'Sección de generación no encontrada.' });
  const data = generationInput(req.body, section.order);
  if (data.error) return res.status(400).json({ error: data.error });
  return res.json(generationSectionPayload(await prisma.reportGenerationSection.update({ where: { id }, data })));
}

export async function updateGenerationSectionContent(req, res) {
  const id = Number(req.params.sectionId);
  if (typeof req.body?.contentHtml !== 'string') return res.status(400).json({ error: 'El contenido debe ser texto.' });
  const section = await prisma.reportGenerationSection.findFirst({ where: { id, draft: { authorId: req.user.id } } });
  if (!section) return res.status(404).json({ error: 'Sección de generación no encontrada.' });
  const contentHtml = sanitizeDraftHtml(req.body.contentHtml);
  return res.json(await prisma.reportGenerationSection.update({ where: { id }, data: { contentHtml, contentText: htmlToPlainText(contentHtml) }, select: { id: true, updatedAt: true, contentHtml: true } }));
}

export async function deleteGenerationSection(req, res) {
  const id = Number(req.params.sectionId);
  const section = await prisma.reportGenerationSection.findFirst({ where: { id, draft: { authorId: req.user.id } }, select: { id: true } });
  if (!section) return res.status(404).json({ error: 'Sección de generación no encontrada.' });
  await prisma.reportGenerationSection.delete({ where: { id } });
  return res.status(204).end();
}

export async function importGenerationSections(req, res) {
  const draftId = Number(req.params.id);
  if (!(await ownDraft(draftId, req.user.id))) return res.status(404).json({ error: 'Borrador no encontrado.' });
  if (!req.file) return res.status(400).json({ error: 'Debe subir un PDF o DOCX.' });

  const format = formatFromName(req.file.originalname);
  if (!['pdf', 'docx'].includes(format)) return res.status(400).json({ error: 'Solo se aceptan PDF o DOCX.' });

  const text = await extractText(req.file.buffer, format);
  if (!text?.trim()) return res.status(422).json({ error: 'No se pudo extraer texto del documento.' });

  // Solo se toma la descripción de cada sección: es lo único que usa el prompt.
  // Las instrucciones quedan vacías para que el usuario escriba las suyas.
  const sections = parseSectionDescriptions(text);
  if (!sections.length) return res.status(422).json({ error: 'No se detectaron secciones numeradas.' });

  await prisma.reportGenerationSection.deleteMany({ where: { draftId } });

  const created = await prisma.$transaction(sections.map((section, index) =>
    prisma.reportGenerationSection.create({
      data: {
        draftId,
        code: section.code,
        name: section.name,
        description: section.description,
        requirements: { minSources: 1, maxSources: 5, instructions: [] },
        order: index,
      },
    })
  ));

  return res.status(201).json({ sections: created.map(generationSectionPayload) });
}

/** POST /report-drafts/:id/preview — prepara una vista trazable de 1 a 5 fuentes. */
const PREVIEW_ERROR_STATUS = {
  MIN_SOURCES_NOT_MET: 400,
  MAX_SOURCES_EXCEEDED: 400,
  NO_RELEVANT_CONTENT: 422,
  AI_NOT_CONFIGURED: 503,
  AI_UNAVAILABLE: 503,
  AI_RATE_LIMITED: 429,
};

export async function previewDraftFromDocuments(req, res) {
  const draftId = Number(req.params.id);
  const sectionId = Number(req.body?.sectionId);
  const documentIds = req.body?.documentIds;

  if (!Number.isInteger(draftId) || !Number.isInteger(sectionId) || !Array.isArray(documentIds)) {
    return res.status(400).json({ error: 'Debe enviar sectionId y documentIds como datos válidos.' });
  }

  const ids = [...new Set(documentIds.map(Number))];
  if (ids.length < 1 || ids.length > 5 || ids.some((id) => !Number.isInteger(id) || id < 1)) {
    return res.status(400).json({ error: 'Seleccione entre 1 y 5 documentos.' });
  }

  // Todo dentro del try: en Express 4 un rechazo fuera de él no llega a ningún
  // manejador y puede tumbar el proceso (ver router.param en routes/index.js).
  try {
    const draft = await prisma.reportDraft.findFirst({
      where: { id: draftId, authorId: req.user.id },
      select: { id: true },
    });
    if (!draft) return res.status(404).json({ error: 'Borrador no encontrado.' });

    const documents = await prisma.document.findMany({
      where: { id: { in: ids }, deletedAt: null, ...viewFilter(req.user) },
      select: { id: true },
    });
    if (documents.length !== ids.length) {
      return res.status(404).json({ error: 'Uno o más documentos no están disponibles.' });
    }

    const selectColumns = { id: true, name: true, description: true, requirements: true };
    const generationSection = await prisma.reportGenerationSection.findFirst({
      where: { id: sectionId, draftId },
      select: selectColumns,
    });
    const selectedSection =
      generationSection || (await prisma.reportSection.findUnique({ where: { id: sectionId }, select: selectColumns }));
    if (!selectedSection) return res.status(404).json({ error: 'Sección no encontrada.' });

    // El tope de 150 palabras y el saneo de reglas viven en reportPreview.service.
    const preview = await generateReportPreview({
      section: selectedSection,
      requirements: selectedSection.requirements,
      documentIds: ids,
    });
    return res.json(preview);
  } catch (error) {
    const status = PREVIEW_ERROR_STATUS[error.code] ?? 500;
    if (status === 500) console.error('Error generando vista previa:', error);
    if (error.retryAfterSeconds) res.set('Retry-After', String(error.retryAfterSeconds));
    return res.status(status).json({
      error: status === 500 ? 'Error al generar la vista previa.' : error.message,
      code: error.code || 'AI_PREVIEW_ERROR',
      retryAfterSeconds: error.retryAfterSeconds,
    });
  }
}

/** POST /report-drafts/:id/incoherences — analiza pares similares entre fuentes. */
export async function detectDraftIncoherences(req, res) {
  const draftId = Number(req.params.id);
  const documentIds = req.body?.documentIds;
  if (!Number.isInteger(draftId) || !Array.isArray(documentIds)) {
    return res.status(400).json({ error: 'Debe enviar documentIds como un arreglo.' });
  }

  const ids = [...new Set(documentIds.map(Number))];
  if (ids.length < 2 || ids.length > 5 || ids.some((id) => !Number.isInteger(id) || id < 1)) {
    return res.status(400).json({ error: 'Seleccione entre 2 y 5 documentos.' });
  }

  try {
    const draft = await prisma.reportDraft.findFirst({
      where: { id: draftId, authorId: req.user.id },
      select: { id: true },
    });
    if (!draft) return res.status(404).json({ error: 'Borrador no encontrado.' });

    const documents = await prisma.document.findMany({
      where: { id: { in: ids }, deletedAt: null, ...viewFilter(req.user) },
      select: { id: true },
    });
    if (documents.length !== ids.length) {
      return res.status(404).json({ error: 'Uno o más documentos no están disponibles.' });
    }

    return res.json(await detectDocumentIncoherences(ids));
  } catch (error) {
    const status = error.code === 'AI_RATE_LIMITED' ? 429
      : ['AI_NOT_CONFIGURED', 'AI_UNAVAILABLE'].includes(error.code) ? 503 : 502;
    if (status === 502) console.error('Error detectando incoherencias:', error);
    if (error.retryAfterSeconds) res.set('Retry-After', String(error.retryAfterSeconds));
    return res.status(status).json({
      error: error.message,
      code: error.code || 'INCOHERENCE_ERROR',
      retryAfterSeconds: error.retryAfterSeconds,
    });
  }
}

async function getExportData(req, draftId) {
  const draft = await prisma.reportDraft.findFirst({
    where: { id: draftId, authorId: req.user.id },
    select: { id: true, title: true, contentHtml: true },
  });
  if (!draft) return null;

  const structure = await prisma.reportStructureVersion.findFirst({
    where: { active: true },
    include: { sections: { orderBy: { order: 'asc' } } },
  });
  const savedSections = await prisma.reportDraftSection.findMany({
    where: { draftId },
    select: { structureSectionId: true, contentHtml: true },
  });
  const contentBySection = new Map(savedSections.map((section) => [section.structureSectionId, section.contentHtml]));

  return {
    title: draft.title,
    sections: structure?.sections.map((section) => ({
      code: section.code,
      name: section.name,
      contentHtml: contentBySection.get(section.id) || '',
    })) || [{ code: '', name: '', contentHtml: draft.contentHtml }],
  };
}

function exportHtml(data) {
  const sections = data.sections.map((section) => `
    <section>
      <h2>${escapeHtml(section.code ? `${section.code}. ${section.name}` : section.name)}</h2>
      ${section.contentHtml || '<p></p>'}
    </section>
  `).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(data.title)}</title>
    <style>body{font-family:Georgia,Cambria,serif;color:#1c1e26;max-width:46rem;margin:2.5rem auto;padding:0 1.5rem;line-height:1.6}h1{font-size:1.9rem}h2{font-size:1.35rem;margin-top:2rem}blockquote{border-left:3px solid #b78c4a;padding-left:.9rem;color:#454545}section{break-inside:avoid}</style>
    </head><body><h1>${escapeHtml(data.title)}</h1>${sections}</body></html>`;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function inlineRuns(node, inherited = {}) {
  if (!node) return [];
  if (node.type === 'text') return [new TextRun({ text: node.data, bold: inherited.bold, italics: inherited.italics })];
  if (node.type !== 'tag') return (node.children || []).flatMap((child) => inlineRuns(child, inherited));

  const next = {
    bold: inherited.bold || node.name === 'strong' || node.name === 'b',
    italics: inherited.italics || node.name === 'em' || node.name === 'i',
  };
  return (node.children || []).flatMap((child) => inlineRuns(child, next));
}

function formattedParagraphs(html) {
  const root = parseDocument(html || '');
  const paragraphs = [];
  const visit = (node, options = {}) => {
    if (!node || node.type !== 'tag') return;
    const name = node.name;
    if (['p', 'h1', 'h2', 'h3', 'blockquote', 'li'].includes(name)) {
      const children = (node.children || []).flatMap((child) => inlineRuns(child));
      const heading = name === 'h1' ? HeadingLevel.HEADING_1 : name === 'h2' ? HeadingLevel.HEADING_2 : name === 'h3' ? HeadingLevel.HEADING_3 : undefined;
      paragraphs.push(new Paragraph({
        children,
        heading,
        bullet: name === 'li' ? { level: options.listLevel || 0 } : undefined,
        indent: name === 'blockquote' ? { left: 720 } : undefined,
      }));
      return;
    }
    const listLevel = name === 'ul' || name === 'ol' ? (options.listLevel || 0) + 1 : options.listLevel;
    for (const child of node.children || []) visit(child, { listLevel });
  };
  for (const node of root.children || []) visit(node);
  return paragraphs;
}

export async function exportDraftPdf(req, res) {
  const data = await getExportData(req, Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Borrador no encontrado.' });
  res.type('html').send(exportHtml(data));
}

export async function exportDraftDocx(req, res) {
  const data = await getExportData(req, Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Borrador no encontrado.' });

  const paragraphs = [new Paragraph({ text: data.title, heading: HeadingLevel.TITLE })];
  for (const section of data.sections) {
    paragraphs.push(new Paragraph({ text: `${section.code ? `${section.code}. ` : ''}${section.name}`, heading: HeadingLevel.HEADING_1 }));
    paragraphs.push(...formattedParagraphs(section.contentHtml));
  }

  const buffer = await Packer.toBuffer(new Document({ sections: [{ children: paragraphs }] }));
  res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(data.title || 'borrador')}.docx"`);
  return res.send(buffer);
}

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