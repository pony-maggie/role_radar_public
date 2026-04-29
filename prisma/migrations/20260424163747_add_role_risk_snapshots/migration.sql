-- CreateTable
CREATE TABLE "RoleRiskSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "snapshotAt" DATETIME NOT NULL,
    "replacementRate" INTEGER,
    "riskLevel" TEXT NOT NULL,
    "ratingStatus" TEXT NOT NULL,
    "wasRecomputed" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoleRiskSnapshot_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RoleRiskSnapshot_roleId_snapshotAt_idx" ON "RoleRiskSnapshot"("roleId", "snapshotAt");
