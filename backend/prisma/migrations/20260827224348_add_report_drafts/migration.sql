-- CreateTable
CREATE TABLE "ReportDraft" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Borrador sin título',
    "contentHtml" TEXT NOT NULL DEFAULT '',
    "contentText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" INTEGER NOT NULL,

    CONSTRAINT "ReportDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportDraftVersion" (
    "id" SERIAL NOT NULL,
    "draftId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL DEFAULT '',
    "contentText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,

    CONSTRAINT "ReportDraftVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportDraft_authorId_updatedAt_idx" ON "ReportDraft"("authorId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportDraftVersion_draftId_version_key" ON "ReportDraftVersion"("draftId", "version");

-- AddForeignKey
ALTER TABLE "ReportDraft" ADD CONSTRAINT "ReportDraft_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportDraftVersion" ADD CONSTRAINT "ReportDraftVersion_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ReportDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportDraftVersion" ADD CONSTRAINT "ReportDraftVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
