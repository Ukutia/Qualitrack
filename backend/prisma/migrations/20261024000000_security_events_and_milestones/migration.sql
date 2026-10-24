ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lockedUntil" TIMESTAMP(3);

CREATE TABLE "SecurityEvent" (
  "id" SERIAL PRIMARY KEY,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" INTEGER,
  "actorEmail" TEXT,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT,
  "result" TEXT NOT NULL
);
CREATE INDEX "SecurityEvent_createdAt_id_idx" ON "SecurityEvent"("createdAt", "id");

CREATE TABLE "Milestone" (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(100) NOT NULL,
  "dueDate" VARCHAR(10) NOT NULL,
  "responsibleId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdById" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "completedAt" TIMESTAMPTZ(3),
  "completedById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Milestone_dueDate_idx" ON "Milestone"("dueDate");
CREATE TABLE "MilestoneTask" (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(200) NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "milestoneId" INTEGER NOT NULL REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
