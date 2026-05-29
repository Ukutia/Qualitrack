// HU09 — Conexión e importación desde Google Drive.
import { config, isGoogleConfigured } from '../config/env.js';
import * as drive from '../services/googleDrive.service.js';
import { ingestDocument } from './documents.controller.js';
import { formatFromName } from '../middleware/upload.js';

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
  // El JWT viaja como "state" para recuperar el usuario en el callback.
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
  const { fileId, location } = req.body || {};
  if (!fileId) return res.status(400).json({ error: 'fileId es obligatorio.' });

  try {
    const file = await drive.downloadFile(req.user.id, fileId);
    const format = formatFromName(file.name);
    if (!format) {
      return res.status(400).json({
        error: `El archivo "${file.name}" no es PDF, DOCX ni XLSX y no puede importarse.`,
        code: 'INVALID_FORMAT',
      });
    }
    const doc = await ingestDocument({
      buffer: file.buffer,
      originalName: file.name,
      userId: req.user.id,
      source: 'GOOGLE_DRIVE',
      cloudFileId: fileId,
      cloudLocation: location || 'Google Drive',
    });
    return res.status(201).json({
      id: doc.id,
      name: doc.originalName,
      message: `"${doc.originalName}" importado desde Google Drive.`,
    });
  } catch (err) {
    console.error('Drive import error:', err.message);
    return res.status(400).json({ error: 'No fue posible importar el archivo desde Google Drive.' });
  }
}
