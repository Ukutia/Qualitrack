import crypto from 'crypto';
import { config } from '../config/env.js';

const PREFIX = 'QTRT1:';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
let cachedKey;
let warnedAboutFallback = false;

function encryptionKey() {
  if (cachedKey) return cachedKey;

  const raw = config.requestTokenEncryptionKey;
  if (!raw && config.nodeEnv === 'production') {
    throw new Error(
      'REQUEST_TOKEN_ENCRYPTION_KEY es obligatoria en producción. Genere una clave con: openssl rand -hex 32'
    );
  }

  if (!raw && !warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn(
      '[requests] REQUEST_TOKEN_ENCRYPTION_KEY no está definida; se usa una clave derivada de JWT_SECRET solo para desarrollo.'
    );
  }

  if (raw && /^[0-9a-fA-F]{64}$/.test(raw)) {
    cachedKey = Buffer.from(raw, 'hex');
  } else if (raw) {
    const decoded = Buffer.from(raw, 'base64');
    cachedKey = decoded.length === 32
      ? decoded
      : crypto.scryptSync(raw, 'qualitrack-request-token', 32);
  } else {
    cachedKey = crypto.scryptSync(config.jwtSecret, 'qualitrack-request-token', 32);
  }
  return cachedKey;
}

/** Hace fallar el arranque si falta la clave obligatoria de producción. */
export function assertRequestTokenConfiguration() {
  encryptionKey();
}

export function hashRequestToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function encryptRequestToken(token) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

export function decryptRequestToken(value) {
  if (!value?.startsWith(PREFIX)) throw new Error('El token almacenado no tiene un formato válido.');
  const payload = Buffer.from(value.slice(PREFIX.length), 'base64');
  if (payload.length <= IV_LENGTH + TAG_LENGTH) throw new Error('El token almacenado está incompleto.');

  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = payload.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/** Token opaco de 256 bits, apto para incluirse directamente en una URL. */
export function createRequestToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashRequestToken(token),
    tokenEncrypted: encryptRequestToken(token),
  };
}

/** Campos seguros que sí existen en DocumentRequest y pueden persistirse. */
export function createStoredRequestToken() {
  const { tokenHash, tokenEncrypted } = createRequestToken();
  return { tokenHash, tokenEncrypted };
}
