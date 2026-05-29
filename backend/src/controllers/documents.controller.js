// HU07 — Carga y gestión de documentos de evidencia.
import { prisma } from '../config/prisma.js';
import { saveFile, deleteFile } from '../services/storage.service.js';
import { extractText } from '../services/textExtraction.service.js';
import { formatFromName } from '../middleware/upload.js';

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
      uploadedById: userId,
    },
  });
}

export async function uploadDocument(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo.' });
  }
  const originalName = req.file.originalname;
  const onDuplicate = (req.query.onDuplicate || '').toLowerCase(); // '', 'replace', 'keep'

  // Manejo de duplicados por nombre (HU07).
  const existing = await prisma.document.findFirst({
    where: { originalName },
    orderBy: { uploadedAt: 'desc' },
  });

  if (existing && !onDuplicate) {
    return res.status(409).json({
      code: 'DUPLICATE_NAME',
      error: 'Ya existe un documento con el mismo nombre.',
      existing: {
        id: existing.id,
        name: existing.originalName,
        creationDate: existing.documentDate,
        uploadDate: existing.uploadedAt,
      },
      message:
        `Ya existe "${originalName}" (subido el ` +
        `${new Date(existing.uploadedAt).toLocaleString('es-CL')}). ` +
        '¿Desea reemplazarlo o conservar ambos?',
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
