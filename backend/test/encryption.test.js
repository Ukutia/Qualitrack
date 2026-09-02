// HDU09: el contenido almacenado en el servidor debe ser ilegible para quien
// acceda directamente al volumen de archivos.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qualitrack-storage-'));
  process.env.STORAGE_DIR = tmpDir;
  process.env.DOC_ENCRYPTION_KEY = 'a'.repeat(64); // clave hex de 32 bytes
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('almacenamiento cifrado', () => {
  it('cifra el texto de PostgreSQL y recupera exactamente el original', async () => {
    const { encryptText, decryptText, isEncryptedText } = await import('../src/services/encryption.service.js');
    const plain = 'Texto extraído confidencial: acreditación 2026.';

    const stored = encryptText(plain);
    expect(stored).toMatch(/^QTENC1:/);
    expect(stored).not.toContain('acreditación');
    expect(isEncryptedText(stored)).toBe(true);
    expect(decryptText(stored)).toBe(plain);
  });

  it('permite migrar registros TEXT históricos que aún estaban en claro', async () => {
    const { decryptText } = await import('../src/services/encryption.service.js');
    expect(decryptText('registro histórico en claro')).toBe('registro histórico en claro');
  });

  it('escribe en disco un contenido ilegible y lo devuelve en claro al leerlo', async () => {
    const { saveFile, readFile } = await import('../src/services/storage.service.js');
    const plain = Buffer.from('Informe de autoevaluación — dato institucional sensible');

    const { storagePath } = await saveFile(plain, 'informe.pdf');

    const onDisk = await fs.readFile(storagePath);
    expect(onDisk.includes('sensible')).toBe(false);
    expect(onDisk.equals(plain)).toBe(false);
    expect(onDisk.subarray(0, 6).toString()).toBe('QTENC1');

    const recovered = await readFile(storagePath);
    expect(recovered.equals(plain)).toBe(true);
  });

  it('usa un IV distinto por archivo (mismo contenido, cifrado distinto)', async () => {
    const { saveFile } = await import('../src/services/storage.service.js');
    const plain = Buffer.from('contenido idéntico');

    const a = await saveFile(plain, 'a.pdf');
    const b = await saveFile(plain, 'b.pdf');

    const [ca, cb] = await Promise.all([fs.readFile(a.storagePath), fs.readFile(b.storagePath)]);
    expect(ca.equals(cb)).toBe(false);
  });

  it('detecta manipulación del archivo en disco', async () => {
    const { saveFile, readFile } = await import('../src/services/storage.service.js');
    const { storagePath } = await saveFile(Buffer.from('original'), 'c.pdf');

    const stored = await fs.readFile(storagePath);
    stored[stored.length - 1] ^= 0xff;
    await fs.writeFile(storagePath, stored);

    await expect(readFile(storagePath)).rejects.toThrow();
  });

  it('sigue leyendo archivos antiguos sin cifrar', async () => {
    const { readFile } = await import('../src/services/storage.service.js');
    const legacyPath = path.join(tmpDir, 'legacy.pdf');
    await fs.writeFile(legacyPath, 'documento antiguo en claro');

    const recovered = await readFile(legacyPath);
    expect(recovered.toString()).toBe('documento antiguo en claro');
  });
});
