// Cola de trabajos de análisis para el worker (HU11).
//
// El backend no llama al worker: lo ofrece. El worker corre en una máquina
// doméstica junto a la GPU, sin IP estable ni puertos abiertos, así que es él
// quien pregunta por HTTPS si hay trabajo. Eso elimina la necesidad de un túnel
// o de una VPN, y hace que un documento encolado mientras el worker está caído
// se procese al volver, en vez de perderse con estado ERROR.

import crypto from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { readFile } from './storage.service.js';
import { updateAnalysisStatus } from './analysisEvents.service.js';

const CRITERION_CODE = '9';

/** Estado en que un documento queda esperando que el worker lo tome. */
export const PENDING_STATUS = 'PREPARING_ANALYSIS';

/** Estado con el que se marca al entregarlo, para que nadie más lo tome. */
export const CLAIMED_STATUS = 'SENT_TO_ANALYZER';

function loadEncryptionKey() {
  const secretKey = process.env.WORKER_ENCRYPTION_KEY;

  if (!secretKey || !/^[0-9a-fA-F]{64}$/.test(secretKey)) {
    throw new Error(
      'WORKER_ENCRYPTION_KEY debe ser 64 caracteres hexadecimales y coincidir ' +
        'con la del worker.'
    );
  }

  return Buffer.from(secretKey, 'hex');
}

/**
 * Entrega el siguiente documento pendiente, ya cifrado, o null si no hay.
 *
 * El reclamo es atómico: updateMany condicionado al estado pendiente. Si dos
 * workers preguntan a la vez, solo uno ve count=1 y el otro sigue de largo.
 */
export async function claimNextJob() {
  const candidato = await prisma.document.findFirst({
    where: { analysisStatus: PENDING_STATUS, deletedAt: null },
    orderBy: { id: 'asc' },
  });

  if (!candidato) return null;

  const { count } = await prisma.document.updateMany({
    where: { id: candidato.id, analysisStatus: PENDING_STATUS },
    data: { analysisStatus: CLAIMED_STATUS, analysisStatusUpdatedAt: new Date() },
  });

  // Otro worker se lo llevó entre el findFirst y el updateMany.
  if (count === 0) return null;

  await updateAnalysisStatus(candidato.id, CLAIMED_STATUS);

  const subcriteria = await prisma.subcriterion.findMany({
    where: { criterion: { code: CRITERION_CODE } },
  });

  // readFile descifra el cifrado en reposo: lo que viaja es el documento real,
  // recifrado con la llave que comparte con el worker.
  const fileBuffer = await readFile(candidato.storagePath);

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', loadEncryptionKey(), iv);
  const encryptedFile = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);

  return {
    documentId: candidato.id,
    userId: candidato.uploadedById,
    format: candidato.format,
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
    fileData: encryptedFile.toString('base64'),
    subcriteria,
  };
}

/**
 * Devuelve a la cola los documentos que un worker tomó y nunca terminó (porque
 * se cayó a mitad de camino). Sin esto quedarían clavados en SENT_TO_ANALYZER
 * para siempre.
 */
export async function requeueStaleJobs(maxAgeMs = 10 * 60 * 1000) {
  const limite = new Date(Date.now() - maxAgeMs);

  const { count } = await prisma.document.updateMany({
    where: {
      analysisStatus: CLAIMED_STATUS,
      analysisStatusUpdatedAt: { lt: limite },
      deletedAt: null,
    },
    data: { analysisStatus: PENDING_STATUS },
  });

  if (count > 0) {
    console.log(`[worker-queue] ${count} documento(s) reencolado(s) por abandono.`);
  }

  return count;
}
