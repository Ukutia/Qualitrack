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
    // Encriptación GCM (Protección de Integridad)
    const fileBuffer = await fs.readFile(doc.storagePath); 
    const algorithm = 'aes-256-gcm'; 
    const secretKey = process.env.WORKER_ENCRYPTION_KEY || 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
    const key = Buffer.from(secretKey, 'hex');     // en vez de secretKey es process.env.WORKER_ENCRYPTION_KEY
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    const encryptedFile = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag(); // El sello matemático de seguridad

    //const workerUrl = process.env.WORKER_URL; 
    const workerUrl = process.env.WORKER_URL || 'http://analysis-worker:4001';
    if (!workerUrl) throw new Error('WORKER_URL no configurada.');

    // Llamada HTTP interna (Túnel Privado)
    const response = await fetch(`${workerUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId,
        userId,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'), // Enviamos el sello
        fileData: encryptedFile.toString('base64'),
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