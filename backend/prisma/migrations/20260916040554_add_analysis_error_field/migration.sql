-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "analysisError" TEXT,
ALTER COLUMN "analysisStatus" DROP NOT NULL;
