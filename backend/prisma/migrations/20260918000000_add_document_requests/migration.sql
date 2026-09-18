-- CreateEnum
CREATE TYPE "DocumentRequestStatus" AS ENUM ('PENDING', 'PAUSED', 'CANCELLED', 'RECEIVED');

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" SERIAL NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reminderIntervalMinutes" INTEGER NOT NULL,
    "nextReminderAt" TIMESTAMP(3),
    "tokenHash" TEXT,
    "tokenEncrypted" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 1,
    "tokenCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER NOT NULL,

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentRequest_tokenHash_key" ON "DocumentRequest"("tokenHash");
CREATE INDEX "DocumentRequest_status_nextReminderAt_idx" ON "DocumentRequest"("status", "nextReminderAt");
CREATE INDEX "DocumentRequest_createdById_createdAt_idx" ON "DocumentRequest"("createdById", "createdAt");

ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
