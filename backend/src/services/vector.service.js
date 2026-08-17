import { PrismaClient } from "@prisma/client";
import { generateEmbedding, EMBEDDING_MODEL } from "./embedding.service.js";
import { chunkText } from "./chunking.service.js";

const prisma = new PrismaClient();

function toPgVector(embedding) {
  return `[${embedding.join(",")}]`;
}

export async function vectorizeDocument(documentId, text) {
  const chunks = chunkText(text);

  if (chunks.length === 0) {
    return {
      documentId,
      chunksCreated: 0,
    };
  }

  // Permite regenerar los embeddings del documento
  await prisma.documentChunk.deleteMany({
    where: { documentId },
  });

  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];

    const embedding = await generateEmbedding(content, "passage");
    const vector = toPgVector(embedding);

    await prisma.$executeRaw`
      INSERT INTO "DocumentChunk"
        ("documentId", "chunkIndex", "content", "embedding", "embeddingModel")
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