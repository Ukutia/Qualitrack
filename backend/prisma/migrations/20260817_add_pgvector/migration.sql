CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "DocumentChunk" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768),
    "embeddingModel" TEXT NOT NULL
        DEFAULT 'intfloat/multilingual-e5-base',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
"DocumentChunk_documentId_chunkIndex_key"
ON "DocumentChunk"("documentId", "chunkIndex");

ALTER TABLE "DocumentChunk"
ADD CONSTRAINT "DocumentChunk_documentId_fkey"
FOREIGN KEY ("documentId")
REFERENCES "Document"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;