-- HU20 supplies audit infrastructure; account lockout belongs to another HU.
-- Keep the previous applied migration intact and remove only its lockout fields.
ALTER TABLE "User" DROP COLUMN "failedLoginAttempts", DROP COLUMN "lockedUntil";
