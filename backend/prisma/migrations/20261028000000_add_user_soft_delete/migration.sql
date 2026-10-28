-- Borrado lógico de integrantes. Las relaciones históricas siguen apuntando a
-- la misma cuenta, mientras que `email` se reemplaza por un identificador
-- interno para permitir reincorporar el correo original.
ALTER TABLE "User"
ADD COLUMN "deletedEmail" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "User_deletedAt_createdAt_idx" ON "User"("deletedAt", "createdAt");
