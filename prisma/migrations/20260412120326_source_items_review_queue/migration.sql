-- CreateTable
CREATE TABLE "SourceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceCatalogId" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summaryEn" TEXT NOT NULL,
    "summaryZh" TEXT,
    "publishedAt" DATETIME NOT NULL,
    "mappingMode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SourceItemRoleDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceItemId" TEXT NOT NULL,
    "roleId" TEXT,
    "decisionStatus" TEXT NOT NULL,
    "confidence" TEXT,
    "reason" TEXT NOT NULL,
    "candidateSlugs" JSONB NOT NULL,
    "matchedKeywords" JSONB NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SourceItemRoleDecision_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SourceItemRoleDecision_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "SourceItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceItem_sourceCatalogId_sourceUrl_key" ON "SourceItem"("sourceCatalogId", "sourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "SourceItemRoleDecision_sourceItemId_key" ON "SourceItemRoleDecision"("sourceItemId");
