import { EventEmitter } from 'events';
import { prisma } from '../config/prisma.js';

// Creamos un "bus de eventos" interno. 
// Esto es lo que permite que el servidor le "grite" al navegador.
export const analysisEvents = new EventEmitter();

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
  // 1. Guardamos el nuevo estado en la base de datos
  await prisma.document.update({
    where: { id: documentId },
    data: {
      analysisStatus: status,
      analysisStatusUpdatedAt: new Date(),
      // El error se limpia cuando el estado deja de serlo. Antes solo se
      // escribia si habia error, asi que un fallo viejo sobrevivia a los
      // analisis posteriores: el documento quedaba en "completado" arrastrando
      // el mensaje de un intento anterior que ya no aplicaba.
      analysisError: status === 'ERROR' ? error : null
    }
  });

  // 2. Disparamos el evento en tiempo real hacia la pantalla del usuario
  publishAnalysisStatus({
    documentId,
    analysisStatus: status,
    analysisError: error,
    analysisStatusUpdatedAt: new Date()
  });
}