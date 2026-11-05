ALTER TABLE "ReportDraftVersion"
ADD COLUMN "sections" JSONB,
ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "ReportDraftVersion"
SET "updatedAt" = "createdAt"
WHERE "updatedAt" IS NULL;

ALTER TABLE "ReportDraftVersion"
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
