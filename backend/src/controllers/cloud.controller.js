// HU09 — Conexión e importación desde Google Drive.
import { config, isGoogleConfigured, maxFileSizeBytes } from '../config/env.js';
import * as drive from '../services/googleDrive.service.js';
import { ingestDocument } from './documents.controller.js';
import { formatFromName } from '../middleware/upload.js';
import { prisma } from '../config/prisma.js';
import { deleteFile } from '../services/storage.service.js';
import { isDropboxConfigured } from '../config/env.js';
import * as dropbox from '../services/dropbox.service.js';

/**
 * Importación de un archivo desde un proveedor de nube conectado.
 * Comparte con la carga manual (HU07) las validaciones de formato/tamaño y el
 * flujo de duplicados (reemplazar / conservar ambos / restaurar de papelera).
 *
 * @param {object} provider  { label, source, service } donde `service` expone
 *                           getFileMeta / downloadFile.
 */
async function importFromCloud(req, res, provider) {
  const { label, source, service } = provider;
  const { fileId, location } = req.body || {};
  const onDuplicate = (req.query.onDuplicate || '').toLowerCase(); // '', 'replace', 'keep', 'restore'
  if (!fileId) return res.status(400).json({ error: 'fileId es obligatorio.' });

  let meta;
  try {
    meta = await service.getFileMeta(req.user.id, fileId);
  } catch (err) {
    console.error(`${label} meta error:`, err.message);
    meta = null;
  }
  if (!meta) {
    return res.status(400).json({
      error: `No fue posible obtener la información del archivo en ${label}. Reconecte la cuenta e inténtelo nuevamente.`,
    });
  }

  // Formato: mismas reglas que la carga manual.
  if (!formatFromName(meta.name)) {
    return res.status(400).json({
      code: 'INVALID_FORMAT',
      error: `El archivo "${meta.name}" no es PDF, DOCX ni XLSX y no puede importarse.`,
    });
  }

  // Tamaño: se valida con el metadato cuando el proveedor lo informa, para no
  // descargar en vano; los formatos nativos de Google no lo informan y se
  // revisan luego sobre el contenido descargado.
  const maxBytes = maxFileSizeBytes();
  const tooBig = (bytes) => ({
    code: 'FILE_TOO_LARGE',
    error: `El archivo "${meta.name}" pesa ${(bytes / 1024 / 1024).toFixed(1)}MB y supera el máximo de ${config.maxFileSizeMb}MB.`,
  });
  if (meta.sizeBytes && meta.sizeBytes > maxBytes) {
    return res.status(400).json(tooBig(meta.sizeBytes));
  }

  const existing = await prisma.document.findFirst({
    where: {
      originalName: meta.name,
      deletedAt: null,
      uploadedById: req.user.id,
    },
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
    });
  }

  // Restaurar el existente: no se importa nada nuevo desde la nube.
  if (existing && onDuplicate === 'restore') {
    await prisma.document.update({ where: { id: existing.id }, data: { deletedAt: null } });
    return res.status(200).json({
      id: existing.id,
      name: existing.originalName,
      message: 'Documento restaurado desde la papelera. No se importó un nuevo archivo.',
    });
  }

  let file;
  try {
    file = await service.downloadFile(req.user.id, fileId);
  } catch (err) {
    console.error(`${label} import error:`, err.message);
    return res.status(400).json({ error: `No fue posible importar el archivo desde ${label}.` });
  }

  if (file.buffer.length > maxBytes) return res.status(400).json(tooBig(file.buffer.length));

  if (existing && onDuplicate === 'replace') {
    await deleteFile(existing.storagePath);
    await prisma.document.delete({ where: { id: existing.id } });
  }

  // El nombre exportado (Google Docs → .docx) manda sobre el del metadato.
  let finalName = file.name || meta.name;
  if (existing && onDuplicate === 'keep') {
    const dot = finalName.lastIndexOf('.');
    const base = dot === -1 ? finalName : finalName.slice(0, dot);
    const ext  = dot === -1 ? '' : finalName.slice(dot);
    finalName = `${base} (copia ${Date.now()})${ext}`;
  }

  const doc = await ingestDocument({
    buffer: file.buffer,
    originalName: finalName,
    userId: req.user.id,
    source,
    cloudFileId: fileId,
    cloudLocation: location || label,
  });

  return res.status(201).json({
    id: doc.id,
    name: doc.originalName,
    format: doc.format,
    sizeBytes: doc.sizeBytes,
    uploadedAt: doc.uploadedAt,
    message: `"${doc.originalName}" importado desde ${label}.`,
  });
}

const NOT_CONFIGURED_DROPBOX = {
  configured: false,
  message: 'La integración con Dropbox no está configurada. Defina DROPBOX_APP_KEY y DROPBOX_APP_SECRET en el archivo .env.',
};

/** GET /cloud/dropbox/status */
export async function dropboxStatus(req, res) {
  if (!isDropboxConfigured()) return res.json(NOT_CONFIGURED_DROPBOX);
  const connected = await dropbox.isConnected(req.user.id);
  return res.json({ configured: true, connected });
}

/** GET /cloud/dropbox/auth-url */
export async function dropboxAuthUrl(req, res) {
  if (!isDropboxConfigured()) return res.status(400).json(NOT_CONFIGURED_DROPBOX);
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return res.json({ url: dropbox.getAuthUrl(token) });
}

/** GET /cloud/dropbox/callback */
export async function dropboxCallback(req, res) {
  const { code, state } = req.query;
  const redirectBack = (ok) =>
    res.redirect(`${config.frontendUrl}/cloud?provider=dropbox&connected=${ok ? '1' : '0'}`);

  if (!isDropboxConfigured() || !code) return redirectBack(false);
  try {
    const jwt = (await import('jsonwebtoken')).default;
    const payload = jwt.verify(state, config.jwtSecret);
    await dropbox.handleCallback(code, payload.sub);
    return redirectBack(true);
  } catch (err) {
    console.error('Dropbox callback error:', err.message);
    return redirectBack(false);
  }
}

/** GET /cloud/dropbox/files */
export async function dropboxListFiles(req, res) {
  if (!isDropboxConfigured()) return res.status(400).json(NOT_CONFIGURED_DROPBOX);
  try {
    const { connected, files } = await dropbox.listFiles(req.user.id, req.query.folderPath);
    if (!connected) return res.status(400).json({ connected: false, error: 'No conectado.' });
    return res.json({ connected: true, files });
  } catch (err) {
    console.error('Dropbox list error:', err.message);
    return res.status(400).json({ connected: false, error: 'Error al listar archivos.' });
  }
}

/** POST /cloud/dropbox/import  Body: { fileId, location } */
export async function dropboxImportFile(req, res) {
  if (!isDropboxConfigured()) return res.status(400).json(NOT_CONFIGURED_DROPBOX);
  return importFromCloud(req, res, {
    label: 'Dropbox',
    source: 'DROPBOX',
    service: dropbox,
  });
}

const NOT_CONFIGURED = {
  configured: false,
  message:
    'La integración con Google Drive no está configurada. Defina GOOGLE_CLIENT_ID y ' +
    'GOOGLE_CLIENT_SECRET en el archivo .env (cree credenciales OAuth en Google Cloud Console, ' +
    'tipo "Aplicación web", con redirect URI ' + config.google.redirectUri + ').',
};

/** GET /cloud/google/status */
export async function status(req, res) {
  if (!isGoogleConfigured()) return res.json(NOT_CONFIGURED);
  const connected = await drive.isConnected(req.user.id);
  return res.json({ configured: true, connected });
}

/** GET /cloud/google/auth-url */
export async function authUrl(req, res) {
  if (!isGoogleConfigured()) return res.status(400).json(NOT_CONFIGURED);
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return res.json({ url: drive.getAuthUrl(token) });
}

/**
 * GET /cloud/google/callback?code=...&state=<token>
 * Google redirige aquí (sin cabeceras). Usamos el JWT pasado como "state".
 */
export async function callback(req, res) {
  const { code, state } = req.query;
  const redirectBack = (ok) =>
    res.redirect(`${config.frontendUrl}/cloud?connected=${ok ? '1' : '0'}`);

  if (!isGoogleConfigured() || !code) return redirectBack(false);
  try {
    const jwt = (await import('jsonwebtoken')).default;
    const payload = jwt.verify(state, config.jwtSecret);
    await drive.handleCallback(code, payload.sub);
    return redirectBack(true);
  } catch (err) {
    console.error('Google callback error:', err.message);
    return redirectBack(false);
  }
}

/** GET /cloud/google/files?folderId= */
export async function listFiles(req, res) {
  if (!isGoogleConfigured()) return res.status(400).json(NOT_CONFIGURED);
  try {
    const { connected, files } = await drive.listFiles(req.user.id, req.query.folderId);
    if (!connected) {
      return res.status(400).json({
        connected: false,
        error: 'No fue posible establecer conexión con la cuenta seleccionada. ' +
          'Vuelva a conectar Google Drive.',
      });
    }
    const documents = files.filter((f) => !f.isFolder);
    return res.json({
      connected: true,
      files,
      empty: documents.length === 0 && files.length === 0,
      message:
        files.length === 0
          ? 'No existen documentos almacenados en esta ubicación.'
          : undefined,
    });
  } catch (err) {
    console.error('Drive list error:', err.message);
    return res.status(400).json({
      connected: false,
      error: 'No fue posible establecer conexión con la cuenta seleccionada ' +
        '(credenciales inválidas o sesión expirada). Reconecte Google Drive.',
    });
  }
}

/** POST /cloud/google/import  Body: { fileId, location } */
export async function importFile(req, res) {
  if (!isGoogleConfigured()) return res.status(400).json(NOT_CONFIGURED);
  return importFromCloud(req, res, {
    label: 'Google Drive',
    source: 'GOOGLE_DRIVE',
    service: drive,
  });
}

/** DELETE /cloud/:provider/disconnect */
export async function disconnect(req, res) {
  const { provider } = req.params;
  await prisma.cloudConnection.deleteMany({
    where: { userId: req.user.id, provider },
  });
  return res.json({ ok: true });
}
