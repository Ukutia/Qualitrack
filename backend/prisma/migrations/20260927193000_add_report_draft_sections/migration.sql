CREATE TABLE "ReportDraftSection" (
    "id" SERIAL NOT NULL,
    "draftId" INTEGER NOT NULL,
    "structureSectionId" INTEGER NOT NULL,
    "contentHtml" TEXT NOT NULL DEFAULT '',
    "contentText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportDraftSection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportDraftSection_draftId_structureSectionId_key"
ON "ReportDraftSection"("draftId", "structureSectionId");

CREATE INDEX "ReportDraftSection_draftId_updatedAt_idx"
ON "ReportDraftSection"("draftId", "updatedAt");

ALTER TABLE "ReportDraftSection"
ADD CONSTRAINT "ReportDraftSection_draftId_fkey"
FOREIGN KEY ("draftId") REFERENCES "ReportDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportDraftSection"
ADD CONSTRAINT "ReportDraftSection_structureSectionId_fkey"
FOREIGN KEY ("structureSectionId") REFERENCES "ReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
