// HU07 — Validación de carga: solo PDF/DOCX/XLSX y ≤ MAX_FILE_SIZE_MB.
import multer from 'multer';
import path from 'path';
import { maxFileSizeBytes, config } from '../config/env.js';

export const ALLOWED = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.xlsx': 'xlsx',
};

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
]);

/** Deriva el formato corto ('pdf'|'docx'|'xlsx') desde el nombre del archivo. */
export function formatFromName(name) {
  return ALLOWED[path.extname(name).toLowerCase()] || null;
}

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const okExt = Boolean(ALLOWED[ext]);
  const okMime = ALLOWED_MIME.has(file.mimetype) || file.mimetype === 'application/octet-stream';
  if (okExt && okMime) return cb(null, true);

  const err = new Error(
    `Formato no permitido. Solo se aceptan archivos PDF, DOCX o XLSX (recibido: ${ext || file.mimetype}). ` +
      'Convierta el documento a uno de esos formatos e inténtelo nuevamente.'
  );
  err.code = 'INVALID_FORMAT';
  return cb(err);
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSizeBytes() },
  fileFilter,
});

export { config };
