-- CreateIndex
CREATE INDEX "Document_analysisStatus_deletedAt_idx" ON "Document"("analysisStatus", "deletedAt");
