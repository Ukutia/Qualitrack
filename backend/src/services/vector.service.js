import { prisma } from "../config/prisma.js";
import {
  generateEmbedding,
  EMBEDDING_MODEL,
} from "./embedding.service.js";
import { chunkText } from "./chunking.service.js";


function toPgVector(embedding) {
  return `[${embedding.join(",")}]`;
}


/**
 * Divide un documento en chunks, genera sus embeddings
 * y los almacena en PostgreSQL + pgvector.
 */
export async function vectorizeDocument(documentId, text) {
  const chunks = chunkText(text);

  if (chunks.length === 0) {
    return {
      documentId,
      chunksCreated: 0,
    };
  }

  // Permite regenerar los embeddings del documento.
  await prisma.documentChunk.deleteMany({
    where: { documentId },
  });

  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];

    const embedding = await generateEmbedding(content, "passage");
    const vector = toPgVector(embedding);

    await prisma.$executeRaw`
      INSERT INTO "DocumentChunk"
        (
          "documentId",
          "chunkIndex",
          "content",
          "embedding",
          "embeddingModel"
        )
      VALUES
        (
          ${documentId},
          ${i},
          ${content},
          ${vector}::vector,
          ${EMBEDDING_MODEL}
        )
    `;
  }

  return {
    documentId,
    chunksCreated: chunks.length,
  };
}


/**
 * Busca los chunks semánticamente más similares a una consulta.
 *
 * @param {string} query
 * @param {Object} options
 * @param {number} options.limit Cantidad máxima de resultados.
 * @param {number|null} options.documentId
 */
export async function searchSimilarChunks(
  query,
  {
    limit = 5,
    documentId = null,
  } = {}
) {
  if (!query || !query.trim()) {
    throw new Error(
      "La consulta para búsqueda semántica no puede estar vacía"
    );
  }

  // Evitar LIMIT inválidos o excesivos.
  const parsedLimit = Number.parseInt(limit, 10);

  const safeLimit = Number.isInteger(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), 50)
    : 5;

  // IMPORTANTE:
  // Qwen genera una representación distinta para queries y passages.
  const embedding = await generateEmbedding(query, "query");
  const vector = toPgVector(embedding);

  let results;

  if (documentId !== null && documentId !== undefined) {
    const parsedDocumentId = Number(documentId);

    if (
      !Number.isInteger(parsedDocumentId) ||
      parsedDocumentId <= 0
    ) {
      throw new Error("documentId inválido");
    }

    results = await prisma.$queryRaw`
      WITH query_vector AS (
        SELECT ${vector}::vector AS embedding
      )

      SELECT
        dc.id,
        dc."documentId",
        dc."chunkIndex",
        d."originalName",
        dc.content,
        dc."embeddingModel",
        1 - (dc.embedding <=> query_vector.embedding) AS similarity

      FROM "DocumentChunk" dc

      JOIN "Document" d
        ON d.id = dc."documentId"

      CROSS JOIN query_vector

      WHERE
        dc.embedding IS NOT NULL
        AND dc."embeddingModel" = ${EMBEDDING_MODEL}
        AND d."deletedAt" IS NULL
        AND dc."documentId" = ${parsedDocumentId}

      ORDER BY
        dc.embedding <=> query_vector.embedding

      LIMIT ${safeLimit}
    `;
  } else {
    results = await prisma.$queryRaw`
      WITH query_vector AS (
        SELECT ${vector}::vector AS embedding
      )

      SELECT
        dc.id,
        dc."documentId",
        dc."chunkIndex",
        d."originalName",
        dc.content,
        dc."embeddingModel",
        1 - (dc.embedding <=> query_vector.embedding) AS similarity

      FROM "DocumentChunk" dc

      JOIN "Document" d
        ON d.id = dc."documentId"

      CROSS JOIN query_vector

      WHERE
        dc.embedding IS NOT NULL
        AND dc."embeddingModel" = ${EMBEDDING_MODEL}
        AND d."deletedAt" IS NULL

      ORDER BY
        dc.embedding <=> query_vector.embedding

      LIMIT ${safeLimit}
    `;
  }

    // Si no hubo resultados, no es necesario consultar asociaciones.
  if (results.length === 0) {
    return [];
  }

  // Obtener los IDs de documentos sin repetir.
  const documentIds = [
    ...new Set(results.map((result) => result.documentId)),
  ];

  // Obtener las asociaciones de todos los documentos en UNA sola consulta.
  const associations = await prisma.association.findMany({
    where: {
      documentId: {
        in: documentIds,
      },
    },
    orderBy: [
      {
        documentId: "asc",
      },
      {
        confidence: "desc",
      },
    ],
    select: {
      documentId: true,
      subcriterion: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  });

  // Como vienen ordenadas por confidence descendente,
  // guardamos solo la primera asociación de cada documento.
  const associationByDocument = new Map();

  for (const association of associations) {
    if (!associationByDocument.has(association.documentId)) {
      associationByDocument.set(
        association.documentId,
        association
      );
    }
  }

  // Agregar la información del subcriterio a cada resultado.
  const enrichedResults = results.map((result) => {
    const association =
      associationByDocument.get(result.documentId);

    return {
      ...result,
      similarity: Number(result.similarity),
      subcriterionCode:
        association?.subcriterion?.code ?? null,
      subcriterionName:
        association?.subcriterion?.name ?? null,
    };
  });

  return enrichedResults;
}