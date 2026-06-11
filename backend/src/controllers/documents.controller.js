// HU07 — Carga y gestión de documentos de evidencia.
import { prisma } from '../config/prisma.js';
import { saveFile, readFile, deleteFile } from '../services/storage.service.js';
import { extractText } from '../services/textExtraction.service.js';
import { extractDocumentDate } from '../services/dateExtraction.service.js';
import { formatFromName } from '../middleware/upload.js';

const MIME = {
  pdf:  'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * Ingesta común usada por la carga directa (HU07) y por la importación desde
 * Google Drive (HU09): guarda el archivo, extrae texto y crea el registro.
 */
export async function ingestDocument({
  buffer,
  originalName,
  userId,
  source = 'UPLOAD',
  cloudFileId = null,
  cloudLocation = null,
}) {
  const format = formatFromName(originalName);
  const { storedName, storagePath } = await saveFile(buffer, originalName);
  const extractedText = await extractText(buffer, format);

  // Detectar la fecha de emisión real del documento desde su contenido
  const documentDate = extractDocumentDate(extractedText, originalName) ?? new Date();

  return prisma.document.create({
    data: {
      originalName,
      storedName,
      format,
      sizeBytes: buffer.length,
      storagePath,
      source,
      cloudFileId,
      cloudLocation,
      extractedText,
      documentDate,
      uploadedById: userId,
    },
  });
}

export async function uploadDocument(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo.' });
  }
  const originalName = req.file.originalname;
  const onDuplicate = (req.query.onDuplicate || '').toLowerCase(); // '', 'replace', 'keep', 'restore'

  // Manejo de duplicados por nombre (HU07).
  const existing = await prisma.document.findFirst({
    where: { originalName },
    orderBy: { uploadedAt: 'desc' },
  });

  if (existing && !onDuplicate) {
    const inTrash = !!existing.deletedAt;
    return res.status(409).json({
      code: 'DUPLICATE_NAME',
      error: inTrash
        ? 'Ya existe un documento con el mismo nombre en la papelera.'
        : 'Ya existe un documento con el mismo nombre.',
      existing: {
        id: existing.id,
        name: existing.originalName,
        creationDate: existing.documentDate,
        uploadDate: existing.uploadedAt,
        inTrash,
        deletedAt: existing.deletedAt,
      },
      message: inTrash
        ? `Ya existe "${originalName}" en la papelera (eliminado el ` +
          `${new Date(existing.deletedAt).toLocaleString('es-CL')}). ` +
          '¿Desea reemplazarlo definitivamente, restaurarlo o conservar ambos?'
        : `Ya existe "${originalName}" (subido el ` +
          `${new Date(existing.uploadedAt).toLocaleString('es-CL')}). ` +
          '¿Desea reemplazarlo o conservar ambos?',
    });
  }

  if (existing && onDuplicate === 'restore') {
    await prisma.document.update({ where: { id: existing.id }, data: { deletedAt: null } });
    return res.status(200).json({
      id: existing.id,
      name: existing.originalName,
      format: existing.format,
      sizeBytes: existing.sizeBytes,
      uploadedAt: existing.uploadedAt,
      message: 'Documento restaurado desde la papelera. No se cargó un nuevo archivo.',
    });
  }

  if (existing && onDuplicate === 'replace') {
    await deleteFile(existing.storagePath);
    await prisma.document.delete({ where: { id: existing.id } });
  }

  let finalName = originalName;
  if (existing && onDuplicate === 'keep') {
    const dot = originalName.lastIndexOf('.');
    const base = dot === -1 ? originalName : originalName.slice(0, dot);
    const ext = dot === -1 ? '' : originalName.slice(dot);
    finalName = `${base} (copia ${Date.now()})${ext}`;
  }

  const doc = await ingestDocument({
    buffer: req.file.buffer,
    originalName: finalName,
    userId: req.user.id,
  });

  return res.status(201).json({
    id: doc.id,
    name: doc.originalName,
    format: doc.format,
    sizeBytes: doc.sizeBytes,
    uploadedAt: doc.uploadedAt,
    message: 'Documento cargado exitosamente.',
  });
}

export async function listDocuments(req, res) {
  const docs = await prisma.document.findMany({
    where: { deletedAt: null },
    orderBy: { uploadedAt: 'desc' },
    include: {
      associations: { include: { subcriterion: true } },
      uploadedBy: { select: { name: true } },
    },
  });

  const result = docs.map((d) => {
    const validated = d.associations.find((a) => a.status === 'VALIDATED');
    const proposed = d.associations.find((a) => a.status === 'PROPOSED');
    let associationStatus = 'Sin clasificar';
    if (validated) associationStatus = 'Validada';
    else if (proposed) associationStatus = 'Propuesta';
    else if (d.associations.length) associationStatus = 'Descartada';

    return {
      id: d.id,
      name: d.originalName,
      format: d.format,
      sizeBytes: d.sizeBytes,
      source: d.source,
      documentDate: d.documentDate,
      uploadedAt: d.uploadedAt,
      uploadedBy: d.uploadedBy?.name,
      associationStatus,
      subcriterion: validated?.subcriterion?.code || proposed?.subcriterion?.code || null,
    };
  });

  return res.json(result);
}

export async function getDocument(req, res) {
  const id = Number(req.params.id);
  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { name: true } },
      associations: {
        include: {
          subcriterion: true,
          validatedBy: { select: { name: true } },
          history: { include: { user: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
        },
      },
    },
  });
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });

  return res.json({
    id: doc.id,
    name: doc.originalName,
    format: doc.format,
    sizeBytes: doc.sizeBytes,
    source: doc.source,
    cloudLocation: doc.cloudLocation,
    documentDate: doc.documentDate,
    uploadedAt: doc.uploadedAt,
    uploadedBy: doc.uploadedBy?.name,
    textPreview: (doc.extractedText || '').slice(0, 1500),
    associations: doc.associations.map((a) => ({
      id: a.id,
      status: a.status,
      subcriterion: { code: a.subcriterion.code, name: a.subcriterion.name },
      justification: a.justification,
      evidenceFragment: a.evidenceFragment,
      confidence: a.confidence,
      validatedBy: a.validatedBy?.name || null,
      validatedAt: a.validatedAt,
      history: a.history.map((h) => ({
        action: h.action,
        user: h.user?.name,
        at: h.createdAt,
      })),
    })),
  });
}

/** Sirve el archivo binario almacenado para visualización o descarga. */
export async function serveFile(req, res) {
  const id = Number(req.params.id);
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });

  let buffer;
  try {
    buffer = await readFile(doc.storagePath);
  } catch {
    return res.status(404).json({ error: 'Archivo no encontrado en el almacenamiento.' });
  }

  const mime = MIME[doc.format] || 'application/octet-stream';
  const disposition = doc.format === 'pdf' ? 'inline' : 'attachment';
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(doc.originalName)}"`);
  res.setHeader('Content-Length', buffer.length);
  return res.send(buffer);
}

/** Permite ajustar la fecha del documento (base de antigüedad para HU02). */
export async function updateDocumentDate(req, res) {
  const id = Number(req.params.id);
  const { documentDate } = req.body || {};
  if (!documentDate) return res.status(400).json({ error: 'documentDate es obligatorio.' });
  const doc = await prisma.document.update({
    where: { id },
    data: { documentDate: new Date(documentDate) },
  });
  return res.json({ id: doc.id, documentDate: doc.documentDate });
}

/** Mueve un documento a la papelera (soft delete). */
export async function trashDocument(req, res) {
  const id = Number(req.params.id);
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });
  if (doc.deletedAt) return res.status(409).json({ error: 'El documento ya está en la papelera.' });

  await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  return res.json({ id, message: 'Documento movido a la papelera.' });
}

/** Lista los documentos en la papelera. */
export async function listTrash(req, res) {
  const docs = await prisma.document.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
    include: { uploadedBy: { select: { name: true } } },
  });
  return res.json(
    docs.map((d) => ({
      id: d.id,
      name: d.originalName,
      format: d.format,
      sizeBytes: d.sizeBytes,
      uploadedAt: d.uploadedAt,
      deletedAt: d.deletedAt,
      uploadedBy: d.uploadedBy?.name,
    }))
  );
}

/** Restaura un documento desde la papelera al repositorio. */
export async function restoreDocument(req, res) {
  const id = Number(req.params.id);
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });
  if (!doc.deletedAt) return res.status(409).json({ error: 'El documento no está en la papelera.' });

  await prisma.document.update({ where: { id }, data: { deletedAt: null } });
  return res.json({ id, message: 'Documento restaurado al repositorio.' });
}

/** Elimina definitivamente un documento de la papelera. */
export async function destroyDocument(req, res) {
  const id = Number(req.params.id);
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });
  if (!doc.deletedAt) {
    return res.status(409).json({ error: 'Mueva el documento a la papelera antes de eliminarlo definitivamente.' });
  }

  await deleteFile(doc.storagePath);
  await prisma.document.delete({ where: { id } });
  return res.json({ id, message: 'Documento eliminado definitivamente.' });
}
