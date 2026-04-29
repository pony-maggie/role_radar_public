-- CreateTable
CREATE TABLE "SearchQueryRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleSlug" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "searchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SearchHit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "publishedAt" DATETIME,
    "rawPayload" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SearchHit_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SearchQueryRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoleEvidenceCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleSlug" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "evidenceKind" TEXT NOT NULL,
    "timelineEligible" BOOLEAN NOT NULL DEFAULT false,
    "scoreEligible" BOOLEAN NOT NULL DEFAULT false,
    "attributionConfidence" REAL,
    "modelProvider" TEXT,
    "modelName" TEXT,
    "rawJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SearchQueryRun_queryHash_key" ON "SearchQueryRun"("queryHash");

-- CreateIndex
CREATE INDEX "SearchQueryRun_roleSlug_provider_idx" ON "SearchQueryRun"("roleSlug", "provider");

-- CreateIndex
CREATE INDEX "SearchQueryRun_expiresAt_idx" ON "SearchQueryRun"("expiresAt");

-- CreateIndex
CREATE INDEX "SearchHit_runId_rank_idx" ON "SearchHit"("runId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "SearchHit_runId_sourceUrl_key" ON "SearchHit"("runId", "sourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "RoleEvidenceCandidate_roleSlug_sourceUrl_key" ON "RoleEvidenceCandidate"("roleSlug", "sourceUrl");

-- CreateIndex
CREATE INDEX "RoleEvidenceCandidate_roleSlug_timelineEligible_updatedAt_idx" ON "RoleEvidenceCandidate"("roleSlug", "timelineEligible", "updatedAt");
