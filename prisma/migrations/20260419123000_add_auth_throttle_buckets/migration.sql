CREATE TABLE "AuthThrottleBucket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "subjectHash" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" DATETIME NOT NULL,
    "blockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "AuthThrottleBucket_action_subjectHash_key" ON "AuthThrottleBucket"("action", "subjectHash");
