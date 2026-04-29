ALTER TABLE "WatchSubscription" ADD COLUMN "lastDigestSentAt" DATETIME;
ALTER TABLE "WatchSubscription" ADD COLUMN "lastAlertSentAt" DATETIME;
ALTER TABLE "WatchSubscription" ADD COLUMN "lastAlertReplacementRate" INTEGER;

CREATE TABLE "NotificationDispatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "roleId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "subjectEn" TEXT NOT NULL,
    "subjectZh" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "windowStart" DATETIME,
    "windowEnd" DATETIME,
    "deliveryMode" TEXT,
    "previewPath" TEXT,
    "errorMessage" TEXT,
    "queuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationDispatch_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "NotificationDispatch_email_kind_status_idx" ON "NotificationDispatch"("email", "kind", "status");
CREATE INDEX "NotificationDispatch_roleId_kind_idx" ON "NotificationDispatch"("roleId", "kind");
