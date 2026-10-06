import { encryptedWorkerContent } from './workerPayload.service.js';
import { dispatcherParaTailnet } from './tailnet.service.js';
import { prisma } from '../config/prisma.js';
import { updateAnalysisStatus } from './analysisEvents.service.js'; // O donde tengas esta función

/**
 * URL con la que el worker debe reconocer a este backend. El worker manda sus
 * webhooks a su propio BACKEND_URL, no a quien le envio el trabajo, asi que un
 * backend local conectado al worker de produccion hacia que los estados de
 * documentos locales se escribieran en los documentos de produccion con el
 * mismo id. Con esto el worker rechaza el trabajo en vez de cruzar datos.
 */
export function publicBackendUrl() {
  if (process.env.BACKEND_PUBLIC_URL) return process.env.BACKEND_PUBLIC_URL;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return `http://localhost:${process.env.PORT || 4000}`;
}

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

    // Encriptación GCM antes de salir a la red (Paso 4). Viaja el texto ya
    // extraido, no el archivo; ver workerPayload.service.js.
    const contenidoCifrado = await encryptedWorkerContent(doc);

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
        backendUrl: publicBackendUrl(),
        ...contenidoCifrado,
        subcriteria
      })
    });

    if (!response.ok) {
      // El worker explica por que rechazo el trabajo (por ejemplo, que
      // reporta a otro backend); ese motivo es lo que el usuario necesita ver.
      const detalle = await response.json().catch(() => null);
      throw new Error(detalle?.error || `Fallo HTTP ${response.status} al contactar al Worker.`);
    }

  } catch (error) {
    await updateAnalysisStatus(documentId, 'ERROR', error.message);
    console.error(`Error enviando al worker (Doc ${documentId}):`, error);
  }
}