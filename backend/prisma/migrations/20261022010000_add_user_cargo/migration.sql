-- HU18: cargo de cada integrante del equipo. Los usuarios existentes quedan con
-- un valor explícito para que la columna pueda ser obligatoria.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "cargo" TEXT NOT NULL DEFAULT 'Sin cargo registrado';
