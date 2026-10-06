// CDA2: lo que sale hacia el worker debe ser ilegible y distinto del original.
import { describe, it, expect, beforeAll } from 'vitest';

const ORIGINAL =
  'Acta del comité de aseguramiento de la calidad. Se revisaron los indicadores ' +
  'de titulación oportuna y retención de primer año del programa.';

let doc;
let svc;

beforeAll(async () => {
  process.env.WORKER_ENCRYPTION_KEY = 'b'.repeat(64);
  process.env.DOC_ENCRYPTION_KEY = 'a'.repeat(64);
  const { encryptText } = await import('../src/services/encryption.service.js');
  svc = await import('../src/services/workerPayload.service.js');
  doc = { extractedText: encryptText(ORIGINAL), storagePath: null, format: 'pdf' };
});

describe('contenido transmitido al worker', () => {
  it('no contiene el texto original ni en binario ni en base64', async () => {
    const payload = await svc.encryptedWorkerContent(doc);
    const cifrado = Buffer.from(payload.fileData, 'base64');

    expect(payload.format).toBe('text');
    expect(cifrado.includes('aseguramiento')).toBe(false);
    expect(payload.fileData.includes('aseguramiento')).toBe(false);
    expect(cifrado.equals(Buffer.from(ORIGINAL))).toBe(false);
    expect(Buffer.from(payload.fileData, 'base64').toString('utf-8')).not.toBe(ORIGINAL);
  });

  it('cifra distinto cada envío del mismo documento', async () => {
    const a = await svc.encryptedWorkerContent(doc);
    const b = await svc.encryptedWorkerContent(doc);
    expect(a.iv).not.toBe(b.iv);
    expect(a.fileData).not.toBe(b.fileData);
  });

  it('el worker lo recupera intacto, y detecta si alguien lo altera', async () => {
    const payload = await svc.encryptedWorkerContent(doc);
    expect(svc.decryptWorkerContent(payload).toString('utf-8')).toBe(ORIGINAL);

    const alterado = Buffer.from(payload.fileData, 'base64');
    alterado[0] ^= 1;
    expect(() =>
      svc.decryptWorkerContent({ ...payload, fileData: alterado.toString('base64') })
    ).toThrow();
  });
});
