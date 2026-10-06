// Contenido cifrado que viaja al worker (HU11 · CDA2).
//
// Lo usan tanto el despacho por push (workerClient) como la cola por pull
// (workerQueue), y también scripts/inspect-worker-payload.js, que lo guarda en
// disco para comprobar que lo transmitido es ilegible. Un solo lugar asegura
// que lo inspeccionado es exactamente lo que sale a la red.
import crypto from 'node:crypto';
import { readFile } from './storage.service.js';
import { decryptText } from './encryption.service.js';

const ALGORITHM = 'aes-256-gcm';

// Sin llave por defecto: una constante en el codigo fuente no protege nada, y
// ademas no coincidiria con la del worker, lo que produce un "unable to
// authenticate data" dificil de rastrear. Mejor fallar aqui.
export function loadWorkerKey() {
  const secretKey = process.env.WORKER_ENCRYPTION_KEY;

  if (!secretKey || !/^[0-9a-fA-F]{64}$/.test(secretKey)) {
    throw new Error(
      'WORKER_ENCRYPTION_KEY debe ser 64 caracteres hexadecimales y coincidir ' +
        'con la del worker. Genera una con: ' +
        'node -e "console.log(require(`crypto`).randomBytes(32).toString(`hex`))"'
    );
  }

  return Buffer.from(secretKey, 'hex');
}

/**
 * Contenido en claro que se va a cifrar. Viaja el texto ya extraido, no el
 * archivo: el backend lo extrae al subir el documento y lo guarda cifrado en la
 * base de datos, y en un PaaS sin volumen persistente los registros sobreviven
 * pero los bytes del archivo no. Sin texto (un PDF escaneado) queda el archivo,
 * si es que todavia existe.
 */
export async function plainWorkerContent(doc) {
  const texto = decryptText(doc.extractedText) || '';
  if (texto.trim()) return { contenido: Buffer.from(texto, 'utf-8'), formato: 'text' };
  return { contenido: await readFile(doc.storagePath), formato: doc.format };
}

/** Cifra el contenido del documento con AES-256-GCM para enviarlo al worker. */
export async function encryptedWorkerContent(doc) {
  const { contenido, formato } = await plainWorkerContent(doc);

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, loadWorkerKey(), iv);
  const encryptedFile = Buffer.concat([cipher.update(contenido), cipher.final()]);

  return {
    format: formato,
    iv: iv.toString('hex'),
    // El sello de GCM: el worker rechaza el contenido si alguien lo alteró.
    authTag: cipher.getAuthTag().toString('hex'),
    fileData: encryptedFile.toString('base64'),
  };
}

/** Lo que hace el worker al recibirlo; sirve para comprobar el viaje de ida y vuelta. */
export function decryptWorkerContent({ iv, authTag, fileData }) {
  const decipher = crypto.createDecipheriv(ALGORITHM, loadWorkerKey(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(fileData, 'base64')), decipher.final()]);
}
