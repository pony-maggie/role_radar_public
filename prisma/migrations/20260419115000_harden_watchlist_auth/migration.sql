ALTER TABLE "EmailVerificationChallenge" ADD COLUMN "requestCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailVerificationChallenge" ADD COLUMN "requestWindowStartedAt" DATETIME;
ALTER TABLE "EmailVerificationChallenge" ADD COLUMN "lastRequestedAt" DATETIME;
ALTER TABLE "EmailVerificationChallenge" ADD COLUMN "failedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailVerificationChallenge" ADD COLUMN "lockedUntil" DATETIME;
