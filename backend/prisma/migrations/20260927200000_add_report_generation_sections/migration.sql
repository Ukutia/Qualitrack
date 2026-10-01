CREATE TABLE "ReportGenerationSection" (
    "id" SERIAL NOT NULL,
    "draftId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requirements" JSONB,
    "contentHtml" TEXT NOT NULL DEFAULT '',
    "contentText" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReportGenerationSection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportGenerationSection_draftId_order_idx"
ON "ReportGenerationSection"("draftId", "order");

ALTER TABLE "ReportGenerationSection"
ADD CONSTRAINT "ReportGenerationSection_draftId_fkey"
FOREIGN KEY ("draftId") REFERENCES "ReportDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;