CREATE TABLE "Folder" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER NOT NULL,
    "parentId" INTEGER,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Document" ADD COLUMN "folderId" INTEGER;

CREATE INDEX "Folder_parentId_createdAt_idx" ON "Folder"("parentId", "createdAt");
CREATE INDEX "Folder_createdById_idx" ON "Folder"("createdById");
CREATE INDEX "Document_folderId_deletedAt_idx" ON "Document"("folderId", "deletedAt");

-- PostgreSQL no ofrece unicidad case-insensitive mediante el esquema Prisma.
-- COALESCE permite aplicar la misma regla a las carpetas de la raíz.
CREATE UNIQUE INDEX "Folder_parent_name_ci_key"
ON "Folder" (COALESCE("parentId", 0), LOWER("name"));

-- La raíz conserva la política histórica de duplicados del repositorio. En
-- una carpeta activa, en cambio, dos archivos no pueden compartir nombre.
CREATE UNIQUE INDEX "Document_folder_name_ci_key"
ON "Document" ("folderId", LOWER("originalName"))
WHERE "folderId" IS NOT NULL AND "deletedAt" IS NULL;

ALTER TABLE "Folder"
ADD CONSTRAINT "Folder_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Folder"
ADD CONSTRAINT "Folder_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Document"
ADD CONSTRAINT "Document_folderId_fkey"
FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
