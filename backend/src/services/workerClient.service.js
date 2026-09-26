import crypto from 'node:crypto';
import { readFile } from './storage.service.js';
import { decryptText } from './encryption.service.js';
import { dispatcherParaTailnet } from './tailnet.service.js';
import { prisma } from '../config/prisma.js';
import { updateAnalysisStatus } from './analysisEvents.service.js'; // O donde tengas esta función

export async function sendToWorker(documentId, userId) {
  try {
    await updateAnalysisStatus(documentId, 'SENT_TO_ANALYZER');

    const doc = await prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
    });
    
    if (!doc) throw new Error('Documento no encontrado.');

    // --- NUEVO: Extraemos los subcriterios para el Worker ---
    const subcriteria = await prisma.subcriterion.findMany({
        where: { criterion: { code: '9' } },
    });
    // --------------------------------------------------------

    // Encriptación del archivo antes de salir a la red (Paso 4)
    // Encriptación GCM (Protección de Integridad)
    // Se manda el texto ya extraido, no el archivo. El backend lo extrae al
    // subir el documento y lo guarda cifrado en la base de datos, asi que
    // reenviar el PDF obligaba al worker a repetir ese trabajo y ataba la
    // clasificacion a que el archivo siguiera en disco, algo que en un PaaS sin
    // volumen persistente no se cumple: los registros sobreviven y los bytes no.
    //
    // De paso el payload baja de ~125 KB en base64 a ~27 KB de texto.
    const texto = decryptText(doc.extractedText) || '';

    let contenido;
    let formato;

    if (texto.trim()) {
      contenido = Buffer.from(texto, 'utf-8');
      formato = 'text';
    } else {
      // Sin texto extraido (por ejemplo un PDF escaneado) queda el archivo,
      // si es que todavia existe.
      contenido = await readFile(doc.storagePath);
      formato = doc.format;
    }

    const fileBuffer = contenido;
    const algorithm = 'aes-256-gcm';

    // Sin llave por defecto: una constante en el codigo fuente no protege
    // nada, y ademas no coincidiria con la del worker, lo que produce un
    // "unable to authenticate data" dificil de rastrear. Mejor fallar aqui.
    const secretKey = process.env.WORKER_ENCRYPTION_KEY;

    if (!secretKey || !/^[0-9a-fA-F]{64}$/.test(secretKey)) {
      throw new Error(
        'WORKER_ENCRYPTION_KEY debe ser 64 caracteres hexadecimales y coincidir ' +
        'con la del worker. Genera una con: ' +
        'node -e "console.log(require(`crypto`).randomBytes(32).toString(`hex`))"'
      );
    }

    const key = Buffer.from(secretKey, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    const encryptedFile = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag(); // El sello matemático de seguridad

    const workerUrl = process.env.WORKER_URL;

    if (!workerUrl) throw new Error('WORKER_URL no configurada.');

    // Un valor como "100.97.61.118" (sin esquema ni puerto) hace que fetch
    // lance "Invalid URL" desde dentro del try, y el error real se pierde.
    try {
      new URL(workerUrl);
    } catch {
      throw new Error(
        `WORKER_URL="${workerUrl}" no es una URL valida. ` +
        'Debe incluir esquema y puerto, por ejemplo http://host.docker.internal:4001'
      );
    }

    // Llamada HTTP interna (Túnel Privado)
    // En Railway el worker vive en la tailnet y hay que salir por el proxy de
    // tailscaled; en local es una URL normal y esto devuelve null.
    const dispatcher = dispatcherParaTailnet(workerUrl);

    const response = await fetch(`${workerUrl}/api/analyze`, {
      ...(dispatcher ? { dispatcher } : {}),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // El worker se publica por un tunel: sin esto su /api/analyze queda
        // abierto a cualquiera que descubra la URL.
        ...(process.env.WORKER_API_TOKEN
          ? { 'x-worker-token': process.env.WORKER_API_TOKEN }
          : {}),
      },
      body: JSON.stringify({
        documentId,
        userId,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'), // Enviamos el sello
        fileData: encryptedFile.toString('base64'),
        format: formato,
        subcriteria
      })
    });

    if (!response.ok) {
       throw new Error('Fallo HTTP al contactar al Worker.');
    }

  } catch (error) {
    await updateAnalysisStatus(documentId, 'ERROR', error.message);
    console.error(`Error enviando al worker (Doc ${documentId}):`, error);
  }
}