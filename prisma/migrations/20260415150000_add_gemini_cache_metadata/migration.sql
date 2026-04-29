-- AlterTable
ALTER TABLE "Role" ADD COLUMN "riskInputHash" TEXT;
ALTER TABLE "Role" ADD COLUMN "riskPromptVersion" TEXT;
ALTER TABLE "Role" ADD COLUMN "riskCachedAt" DATETIME;

-- AlterTable
ALTER TABLE "SourceItem" ADD COLUMN "classificationInputHash" TEXT;
ALTER TABLE "SourceItem" ADD COLUMN "classificationPromptVersion" TEXT;
ALTER TABLE "SourceItem" ADD COLUMN "classificationModelName" TEXT;
ALTER TABLE "SourceItem" ADD COLUMN "classificationCachedAt" DATETIME;
