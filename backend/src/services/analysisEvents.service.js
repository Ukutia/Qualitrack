import { EventEmitter } from 'events';
import { prisma } from '../config/prisma.js';

// Creamos un "bus de eventos" interno.
// Esto es lo que permite que el servidor le "grite" al navegador.
export const analysisEvents = new EventEmitter();

// Cada pestaña abierta en una ficha (y el vigilante global de análisis) suma
// un listener; el tope por defecto de 10 dispararía avisos falsos de fuga.
analysisEvents.setMaxListeners(0);

/**
 * Empuja el evento SSE a todos los clientes (navegadores)
 * que estén escuchando este documento en específico.
 */
export function publishAnalysisStatus(payload) {
  analysisEvents.emit(`status-${payload.documentId}`, payload);
}

/**
 * Función combinada: Actualiza la base de datos (Prisma)
 * y automáticamente le avisa al frontend (SSE).
 */
export async function updateAnalysisStatus(documentId, status, error = null) {
  const now = new Date();

  // 1. Guardamos el nuevo estado en la base de datos
  await prisma.document.update({
    where: { id: documentId },
    data: {
      analysisStatus: status,
      analysisStatusUpdatedAt: now,

      // Solo se reinicia cuando comienza un NUEVO análisis.
      // Los estados posteriores no alteran este instante.
      ...(status === 'PREPARING_ANALYSIS'
        ? { analysisStartedAt: now }
        : {}),

      analysisError: status === 'ERROR' ? error : null,
    },
  });

  // 2. Disparamos el evento en tiempo real hacia la pantalla del usuario
  publishAnalysisStatus({
    documentId,
    analysisStatus: status,
    analysisError: error,
    analysisStatusUpdatedAt: now,
    analysisStartedAt:
      status === 'PREPARING_ANALYSIS' ? now : undefined,
  });
}