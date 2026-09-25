CREATE TYPE "RequestEmailType" AS ENUM ('INITIAL', 'REMINDER', 'RESUMED');
CREATE TYPE "RequestEmailStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

CREATE TABLE "DocumentRequestEmail" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "tokenVersion" INTEGER NOT NULL,
    "type" "RequestEmailType" NOT NULL,
    "status" "RequestEmailStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DocumentRequestEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentRequestEmail_requestId_tokenVersion_key"
ON "DocumentRequestEmail"("requestId", "tokenVersion");
CREATE INDEX "DocumentRequestEmail_status_nextAttemptAt_idx"
ON "DocumentRequestEmail"("status", "nextAttemptAt");

ALTER TABLE "DocumentRequestEmail"
ADD CONSTRAINT "DocumentRequestEmail_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "DocumentRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
