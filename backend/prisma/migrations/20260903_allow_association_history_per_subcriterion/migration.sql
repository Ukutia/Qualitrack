-- Cada ejecución de la IA debe conservarse como una propuesta independiente,
-- incluso cuando coincide con el subcriterio actualmente validado.
DROP INDEX IF EXISTS "Association_documentId_subcriterionId_key";

CREATE INDEX "Association_documentId_subcriterionId_idx"
ON "Association"("documentId", "subcriterionId");
