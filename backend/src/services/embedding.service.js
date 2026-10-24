import { config } from '../config/env.js';

const EMBEDDING_DIMENSIONS = 768;
const EMBEDDING_MODEL = "Qwen/Qwen3-Embedding-0.6B";

/**
 * Genera un embedding utilizando el servicio local de embeddings.
 *
 * type:
 * - "passage": textos/documentos que almacenaremos
 * - "query": consultas que utilizaremos para buscar
 */
export async function generateEmbedding(text, type = "passage") {
  if (!config.embeddings.enabled) {
    const error = new Error('La búsqueda semántica está desactivada.');
    error.code = 'EMBEDDINGS_DISABLED';
    throw error;
  }

  if (!text || !text.trim()) {
    throw new Error("No se puede generar un embedding de un texto vacío");
  }

  const response = await fetch(`${config.embeddings.serviceUrl}/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      type,
    }),
    signal: AbortSignal.timeout(config.embeddings.timeoutMs),
  });

  if (!response.ok) {
    const error = await response.text();

    throw new Error(
      `Error del servicio de embeddings (${response.status}): ${error}`
    );
  }

  const result = await response.json();

  if (
    !Array.isArray(result.embedding) ||
    result.embedding.length !== EMBEDDING_DIMENSIONS
  ) {
    throw new Error(
      `Embedding inválido. Se esperaban ${EMBEDDING_DIMENSIONS} dimensiones`
    );
  }

  return result.embedding;
}

export {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
};
