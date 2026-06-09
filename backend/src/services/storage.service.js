// Almacenamiento de archivos en volumen local (montado en config.storageDir).
// Aísla el acceso al disco para poder migrar a S3/GCS sin tocar el resto.
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/env.js';

async function ensureDir() {
  await fs.mkdir(config.storageDir, { recursive: true });
}

/**
 * Guarda un buffer y devuelve { storedName, storagePath }.
 */
export async function saveFile(buffer, originalName) {
  await ensureDir();
  const ext = path.extname(originalName);
  const storedName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const storagePath = path.join(config.storageDir, storedName);
  await fs.writeFile(storagePath, buffer);
  return { storedName, storagePath };
}

export async function readFile(storagePath) {
  return fs.readFile(storagePath);
}

export async function deleteFile(storagePath) {
  try {
    await fs.unlink(storagePath);
  } catch {
    /* el archivo ya no existe: se ignora */
  }
}
