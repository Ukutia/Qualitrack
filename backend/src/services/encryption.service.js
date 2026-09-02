// Cifrado de contenido en reposo (HDU09).
// Los archivos se guardan en disco cifrados con AES-256-GCM, de modo que quien
// acceda directamente al volumen del servidor sólo vea bytes ilegibles.
//
// Formato del envoltorio (todo binario, concatenado):
//   magic "QTENC1" (6 bytes) | iv (12 bytes) | authTag (16 bytes) | ciphertext
//
// El authTag permite detectar manipulación del archivo: si alguien edita el
// binario en disco, el descifrado falla en vez de devolver basura.
import crypto from 'crypto';
import { config } from '../config/env.js';

const MAGIC = Buffer.from('QTENC1', 'utf8');
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = MAGIC.length + IV_LEN + TAG_LEN;
const ALGORITHM = 'aes-256-gcm';
const TEXT_PREFIX = 'QTENC1:';

let cachedKey = null;

/**
 * Resuelve la clave de 32 bytes a partir de DOC_ENCRYPTION_KEY.
 * Acepta hex (64 chars), base64 (44 chars) o cualquier passphrase, que se
 * deriva con scrypt. Si no está configurada, deriva de JWT_SECRET para que
 * los entornos de desarrollo existentes sigan funcionando sin tocar el .env.
 */
function getKey() {
  if (cachedKey) return cachedKey;

  const raw = config.docEncryptionKey;
  if (raw) {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      cachedKey = Buffer.from(raw, 'hex');
    } else {
      const decoded = Buffer.from(raw, 'base64');
      cachedKey = decoded.length === 32
        ? decoded
        : crypto.scryptSync(raw, 'qualitrack-doc-storage', 32);
    }
  } else {
    if (config.nodeEnv === 'production') {
      console.warn(
        '[encryption] DOC_ENCRYPTION_KEY no está definida: se deriva de JWT_SECRET. ' +
        'Defina una clave dedicada en producción.'
      );
    }
    cachedKey = crypto.scryptSync(config.jwtSecret, 'qualitrack-doc-storage', 32);
  }
  return cachedKey;
}

/** True si el buffer leído del disco tiene el envoltorio cifrado. */
export function isEncrypted(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= HEADER_LEN
    && buffer.subarray(0, MAGIC.length).equals(MAGIC);
}

/** Cifra un buffer en claro y devuelve el envoltorio listo para escribir. */
export function encryptBuffer(plain) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

/**
 * Descifra un envoltorio. Los archivos anteriores a esta funcionalidad se
 * devuelven tal cual (no tienen el magic), para no romper el histórico.
 */
export function decryptBuffer(stored) {
  if (!isEncrypted(stored)) return stored;

  const iv = stored.subarray(MAGIC.length, MAGIC.length + IV_LEN);
  const tag = stored.subarray(MAGIC.length + IV_LEN, HEADER_LEN);
  const ciphertext = stored.subarray(HEADER_LEN);

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Cifra texto para almacenarlo en una columna TEXT. El resultado nunca
 * contiene el texto original y cada llamada usa un IV distinto.
 */
export function encryptText(plain) {
  if (plain == null) return plain;
  return TEXT_PREFIX + encryptBuffer(Buffer.from(String(plain), 'utf8')).toString('base64');
}

/**
 * Descifra texto de PostgreSQL solamente cuando el backend necesita usarlo.
 * Mantiene compatibilidad temporal con filas creadas antes del cifrado.
 */
export function decryptText(stored) {
  if (stored == null || !stored.startsWith(TEXT_PREFIX)) return stored;
  const payload = Buffer.from(stored.slice(TEXT_PREFIX.length), 'base64');
  return decryptBuffer(payload).toString('utf8');
}

/** Indica si un valor de columna TEXT ya está protegido por este servicio. */
export function isEncryptedText(value) {
  return typeof value === 'string' && value.startsWith(TEXT_PREFIX);
}
