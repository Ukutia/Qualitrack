// HU09 — Integración con Dropbox (OAuth 2.0)
import { config } from '../config/env.js';
import { prisma } from '../config/prisma.js';

const AUTH = 'https://www.dropbox.com/oauth2';
const API  = 'https://api.dropboxapi.com/2';
const CONTENT = 'https://content.dropboxapi.com/2';

const DROPBOX_EXPORT_MAP = {
  'application/vnd.google-apps.document': { ext: '.docx' }, // no aplica en Dropbox
};

export function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id:         config.dropbox.appKey,
    response_type:     'code',
    redirect_uri:      config.dropbox.redirectUri,
    token_access_type: 'offline',
    state,
  });
  return `${AUTH}/authorize?${params}`;
}

export async function handleCallback(code, userId) {
  const res = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type:    'authorization_code',
      client_id:     config.dropbox.appKey,
      client_secret: config.dropbox.appSecret,
      redirect_uri:  config.dropbox.redirectUri,
    }),
  });
  const tokens = await res.json();
  await prisma.cloudConnection.upsert({
    where: { userId_provider: { userId, provider: 'dropbox' } },
    update: {
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt:    null,
    },
    create: {
      userId,
      provider:     'dropbox',
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt:    null,
    },
  });
}

async function getTokens(userId) {
  const conn = await prisma.cloudConnection.findUnique({
    where: { userId_provider: { userId, provider: 'dropbox' } },
  });
  if (!conn) return null;

  // Refresh siempre que haya refresh token
  if (conn.refreshToken) {
    const credentials = Buffer.from(`${config.dropbox.appKey}:${config.dropbox.appSecret}`).toString('base64');
    const res = await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: conn.refreshToken,
      }),
    });
    const refreshed = await res.json();
    if (refreshed.access_token) {
      await prisma.cloudConnection.update({
        where: { userId_provider: { userId, provider: 'dropbox' } },
        data: { accessToken: refreshed.access_token },
      });
      return refreshed.access_token;
    }
  }
  return conn.accessToken;
}

export async function isConnected(userId) {
  const conn = await prisma.cloudConnection.findUnique({
    where: { userId_provider: { userId, provider: 'dropbox' } },
  });
  return Boolean(conn);
}

export async function listFiles(userId, folderPath = '') {
  const token = await getTokens(userId);
  if (!token) return { connected: false, files: [] };

  const res = await fetch(`${API}/files/list_folder`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: folderPath || '' }),
  });
  const data = await res.json();
  if (data.error_summary) throw new Error(data.error_summary);

  const files = data.entries.map((f) => ({
    id:           f.path_lower,
    name:         f.name,
    isFolder:     f['.tag'] === 'folder',
    mimeType:     f['.tag'] === 'folder' ? 'folder' : 'file',
    modifiedTime: f.server_modified,
    location:     folderPath || '/',
  }));

  return { connected: true, files };
}

export async function getFileMeta(userId, filePath) {
  const token = await getTokens(userId);
  if (!token) return null;

  const res = await fetch(`${API}/files/get_metadata`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: filePath }),
  });
  const data = await res.json();
  return { name: data.name, mimeType: 'file' };
}

export async function downloadFile(userId, filePath) {
  const token = await getTokens(userId);
  if (!token) throw new Error('NOT_CONNECTED');

  const res = await fetch(`${CONTENT}/files/download`, {
    method: 'POST',
    headers: {
      Authorization:     `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path: filePath }),
    },
  });

  const buffer = Buffer.from(await res.arrayBuffer());
  const name = JSON.parse(res.headers.get('dropbox-api-result')).name;
  return { name, mimeType: 'file', buffer };
}