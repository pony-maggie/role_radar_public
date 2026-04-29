-- DropIndex
DROP INDEX "Signal_sourceUrl_key";

-- CreateIndex
CREATE UNIQUE INDEX "Signal_roleId_sourceUrl_key" ON "Signal"("roleId", "sourceUrl");
