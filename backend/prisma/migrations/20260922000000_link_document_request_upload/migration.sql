ALTER TABLE "DocumentRequest" ADD COLUMN "documentId" INTEGER;

CREATE UNIQUE INDEX "DocumentRequest_documentId_key" ON "DocumentRequest"("documentId");

ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
