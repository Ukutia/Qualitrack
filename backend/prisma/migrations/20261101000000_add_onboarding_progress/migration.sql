CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

CREATE TABLE "OnboardingProgress" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "status" "OnboardingStatus" NOT NULL DEFAULT 'PENDING',
  "completedStepIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "authorizedStepIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnboardingProgress_userId_key"
ON "OnboardingProgress"("userId");

ALTER TABLE "OnboardingProgress"
ADD CONSTRAINT "OnboardingProgress_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
