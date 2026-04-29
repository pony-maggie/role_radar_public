-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "ambiguityScore" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "summaryEn" TEXT NOT NULL,
    "summaryZh" TEXT NOT NULL,
    "rationaleEn" TEXT NOT NULL,
    "rationaleZh" TEXT NOT NULL,
    CONSTRAINT "Signal_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchSubscription_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_slug_key" ON "Role"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Signal_sourceUrl_key" ON "Signal"("sourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "WatchSubscription_email_roleId_key" ON "WatchSubscription"("email", "roleId");
