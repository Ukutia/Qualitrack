// HU09 — Integración real con Google Drive (OAuth 2.0 authorization code).
// Si faltan credenciales, isGoogleConfigured() es false y los controllers
// responden "no configurado".
import { google } from 'googleapis';
import { config, isGoogleConfigured } from '../config/env.js';
import { prisma } from '../config/prisma.js';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

function oauthClient() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

/** Obtiene solo el nombre y mimeType sin descargar el archivo. */
export async function getFileMeta(userId, fileId) {
  const client = await authedClientFor(userId);
  if (!client) return null;
  const drive = google.drive({ version: 'v3', auth: client });
  const meta = await drive.files.get({ fileId, fields: 'name, mimeType' });
  const { name, mimeType } = meta.data;
  // Si es Google Doc nativo, ajustar el nombre con la extensión exportada
  const exportFormat = GOOGLE_EXPORT_MAP[mimeType];
  return {
    name: exportFormat && !name.endsWith(exportFormat.ext) ? name + exportFormat.ext : name,
    mimeType,
  };
}


export function getAuthUrl(state) {
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });
}

/** Intercambia el "code" por tokens y los guarda para el usuario. */
export async function handleCallback(code, userId) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  await prisma.cloudConnection.upsert({
    where: { userId_provider: { userId, provider: 'google' } },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
    create: {
      userId,
      provider: 'google',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
  });
}

async function authedClientFor(userId) {
  const conn = await prisma.cloudConnection.findUnique({
    where: { userId_provider: { userId, provider: 'google' } },
  });
  if (!conn) return null;
  const client = oauthClient();
  client.setCredentials({
    access_token: conn.accessToken,
    refresh_token: conn.refreshToken,
    expiry_date: conn.expiresAt ? conn.expiresAt.getTime() : undefined,
  });
  return client;
}

export async function isConnected(userId) {
  const conn = await prisma.cloudConnection.findUnique({
    where: { userId_provider: { userId, provider: 'google' } },
  });
  return Boolean(conn);
}

/** Lista archivos y carpetas de una carpeta (root por defecto). */
export async function listFiles(userId, folderId = 'root') {
  const client = await authedClientFor(userId);
  if (!client) return { connected: false, files: [] };

  const drive = google.drive({ version: 'v3', auth: client });
  const parent = folderId || 'root';
  const res = await drive.files.list({
    q: `'${parent}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, modifiedTime, parents)',
    pageSize: 100,
    orderBy: 'folder,name',
  });

  const files = (res.data.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime,
    location: parent,
  }));

  return { connected: true, files };
}



export async function downloadFile(userId, fileId) {
  const client = await authedClientFor(userId);
  if (!client) throw new Error('NOT_CONNECTED');

  const drive = google.drive({ version: 'v3', auth: client });
  const meta = await drive.files.get({ fileId, fields: 'name, mimeType' });
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  return {
    name: meta.data.name,
    mimeType: meta.data.mimeType,
    buffer: Buffer.from(res.data),
  };
}

export { isGoogleConfigured };
