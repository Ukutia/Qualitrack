// Almacenamiento de archivos en volumen local (montado en config.storageDir).
// Aísla el acceso al disco para poder migrar a S3/GCS sin tocar el resto.
// El contenido se guarda cifrado (HDU09): ver encryption.service.js.
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { encryptBuffer, decryptBuffer } from './encryption.service.js';

async function ensureDir() {
  await fs.mkdir(config.storageDir, { recursive: true });
}

/**
 * Guarda un buffer cifrado y devuelve { storedName, storagePath }.
 */
export async function saveFile(buffer, originalName) {
  await ensureDir();
  const ext = path.extname(originalName);
  const storedName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}.enc`;
  const storagePath = path.join(config.storageDir, storedName);
  await fs.writeFile(storagePath, encryptBuffer(buffer));
  return { storedName, storagePath };
}

/**
 * Lee un archivo y devuelve su contenido en claro. Los archivos subidos antes
 * de activar el cifrado se devuelven tal cual.
 */
export async function readFile(storagePath) {
  const stored = await fs.readFile(storagePath);
  return decryptBuffer(stored);
}

export async function deleteFile(storagePath) {
  try {
    await fs.unlink(storagePath);
  } catch {
    /* el archivo ya no existe: se ignora */
  }
}
