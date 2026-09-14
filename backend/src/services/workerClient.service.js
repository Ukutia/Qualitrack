import crypto from 'node:crypto';
import fs from 'node:fs/promises';
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
    const fileBuffer = await fs.readFile(doc.storagePath); 
    
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.WORKER_ENCRYPTION_KEY, 'hex'); 
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    const encryptedFile = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);

    const workerUrl = process.env.WORKER_URL; 
    if (!workerUrl) throw new Error('WORKER_URL no configurada.');

    // Llamada HTTP interna (Túnel Privado)
    const response = await fetch(`${workerUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId,
        userId,
        iv: iv.toString('hex'),
        fileData: encryptedFile.toString('base64'),
        subcriteria // <-- NUEVO: Los subcriterios viajan junto con el archivo
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