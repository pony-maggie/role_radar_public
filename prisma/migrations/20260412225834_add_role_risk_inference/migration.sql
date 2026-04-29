-- AlterTable
ALTER TABLE "Role" ADD COLUMN "replacementRate" INTEGER;
ALTER TABLE "Role" ADD COLUMN "riskInferenceRaw" JSONB;
ALTER TABLE "Role" ADD COLUMN "riskModelName" TEXT;
ALTER TABLE "Role" ADD COLUMN "riskModelProvider" TEXT;
ALTER TABLE "Role" ADD COLUMN "riskReasons" JSONB;
ALTER TABLE "Role" ADD COLUMN "riskSummaryEn" TEXT;
ALTER TABLE "Role" ADD COLUMN "riskSummaryZh" TEXT;
