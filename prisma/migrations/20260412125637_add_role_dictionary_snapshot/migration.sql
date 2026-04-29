-- CreateTable
CREATE TABLE "IndustryDictionary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "parentCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RoleDictionary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "socCode" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "industryCode" TEXT NOT NULL,
    "keywords" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoleDictionary_industryCode_fkey" FOREIGN KEY ("industryCode") REFERENCES "IndustryDictionary" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dictionaryRoleId" TEXT,
    "slug" TEXT NOT NULL,
    "socCode" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "summaryEn" TEXT NOT NULL,
    "summaryZh" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "ratingStatus" TEXT NOT NULL DEFAULT 'RATED',
    "lastRatedAt" DATETIME,
    "repetitionScore" INTEGER NOT NULL,
    "ruleClarityScore" INTEGER NOT NULL,
    "transformationScore" INTEGER NOT NULL,
    "workflowAutomationScore" INTEGER NOT NULL,
    "interpersonalScore" INTEGER NOT NULL,
    "physicalityScore" INTEGER NOT NULL,
    "ambiguityScore" INTEGER NOT NULL,
    CONSTRAINT "Role_dictionaryRoleId_fkey" FOREIGN KEY ("dictionaryRoleId") REFERENCES "RoleDictionary" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Role" ("ambiguityScore", "id", "interpersonalScore", "lastRatedAt", "nameEn", "nameZh", "physicalityScore", "ratingStatus", "repetitionScore", "riskLevel", "ruleClarityScore", "slug", "socCode", "summaryEn", "summaryZh", "transformationScore", "workflowAutomationScore") SELECT "ambiguityScore", "id", "interpersonalScore", "lastRatedAt", "nameEn", "nameZh", "physicalityScore", "ratingStatus", "repetitionScore", "riskLevel", "ruleClarityScore", "slug", "socCode", "summaryEn", "summaryZh", "transformationScore", "workflowAutomationScore" FROM "Role";
DROP TABLE "Role";
ALTER TABLE "new_Role" RENAME TO "Role";
CREATE UNIQUE INDEX "Role_dictionaryRoleId_key" ON "Role"("dictionaryRoleId");
CREATE UNIQUE INDEX "Role_slug_key" ON "Role"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "IndustryDictionary_code_key" ON "IndustryDictionary"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RoleDictionary_socCode_key" ON "RoleDictionary"("socCode");

-- CreateIndex
CREATE UNIQUE INDEX "RoleDictionary_slug_key" ON "RoleDictionary"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "RoleDictionary_source_sourceCode_key" ON "RoleDictionary"("source", "sourceCode");
