import { prisma } from "../config/prisma.js";
import { Prisma } from '@prisma/client';
import {
  generateEmbedding,
  EMBEDDING_MODEL,
} from "./embedding.service.js";
import { chunkText } from "./chunking.service.js";
import { encryptText, decryptText } from "./encryption.service.js";


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
          ${encryptText(content)},
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
 * Busca resultados semánticamente similares a una consulta.
 * En la búsqueda global retorna el mejor chunk de cada documento, por lo que
 * el límite representa documentos distintos. Al filtrar por documentId, el
 * límite sigue representando chunks de ese documento.
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
      ),
      ranked_chunks AS (
        SELECT
          dc.id,
          dc."documentId",
          dc."chunkIndex",
          d."originalName",
          dc.content,
          dc."embeddingModel",
          1 - (dc.embedding <=> query_vector.embedding) AS similarity,
          ROW_NUMBER() OVER (
            PARTITION BY dc."documentId"
            ORDER BY dc.embedding <=> query_vector.embedding
          ) AS document_rank

        FROM "DocumentChunk" dc

        JOIN "Document" d
          ON d.id = dc."documentId"

        CROSS JOIN query_vector

        WHERE
          dc.embedding IS NOT NULL
          AND dc."embeddingModel" = ${EMBEDDING_MODEL}
          AND d."deletedAt" IS NULL
      )

      SELECT
        id,
        "documentId",
        "chunkIndex",
        "originalName",
        content,
        "embeddingModel",
        similarity

      FROM ranked_chunks

      WHERE document_rank = 1

      ORDER BY
        similarity DESC

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
      content: decryptText(result.content),
      similarity: Number(result.similarity),
      subcriterionCode:
        association?.subcriterion?.code ?? null,
      subcriterionName:
        association?.subcriterion?.name ?? null,
    };
  });

  return enrichedResults;
}

/** Busca pares de fragmentos similares entre documentos distintos. */
export async function searchSimilarCrossDocumentPairs(documentIds, { limit = 10, threshold = 0.82 } = {}) {
  const ids = [...new Set(documentIds.map(Number))].filter(Number.isInteger);
  if (ids.length < 2) return [];

  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 30);
  const safeThreshold = Math.min(Math.max(Number(threshold) || 0.82, 0), 1);

  const pairs = await prisma.$queryRaw`
    SELECT
      a."documentId" AS "documentIdA",
      da."originalName" AS "originalNameA",
      a.content AS "contentA",
      b."documentId" AS "documentIdB",
      db."originalName" AS "originalNameB",
      b.content AS "contentB",
      1 - (a.embedding <=> b.embedding) AS similarity
    FROM "DocumentChunk" a
    JOIN "DocumentChunk" b ON a."documentId" < b."documentId"
    JOIN "Document" da ON da.id = a."documentId"
    JOIN "Document" db ON db.id = b."documentId"
    WHERE a."documentId" IN (${Prisma.join(ids)})
      AND b."documentId" IN (${Prisma.join(ids)})
      AND da."deletedAt" IS NULL
      AND db."deletedAt" IS NULL
      AND a.embedding IS NOT NULL
      AND b.embedding IS NOT NULL
      AND a."embeddingModel" = ${EMBEDDING_MODEL}
      AND b."embeddingModel" = ${EMBEDDING_MODEL}
      AND 1 - (a.embedding <=> b.embedding) >= ${safeThreshold}
    ORDER BY similarity DESC
    LIMIT ${safeLimit}
  `;

  return pairs.map((pair) => ({
    ...pair,
    similarity: Number(pair.similarity),
    contentA: decryptText(pair.contentA),
    contentB: decryptText(pair.contentB),
  }));
}
