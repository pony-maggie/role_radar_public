-- CreateTable
CREATE TABLE "SourceItemInference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceItemId" TEXT NOT NULL,
    "roleId" TEXT,
    "assignedRoleSlug" TEXT NOT NULL,
    "modelProvider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "inferenceSummaryEn" TEXT NOT NULL,
    "inferenceSummaryZh" TEXT NOT NULL,
    "impactDirection" TEXT NOT NULL,
    "relevance" TEXT NOT NULL,
    "signalWeight" REAL NOT NULL,
    "rawJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SourceItemInference_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SourceItemInference_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "SourceItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceItemInference_sourceItemId_key" ON "SourceItemInference"("sourceItemId");
