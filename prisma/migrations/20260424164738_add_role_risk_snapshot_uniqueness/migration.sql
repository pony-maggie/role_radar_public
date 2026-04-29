/*
  Warnings:

  - A unique constraint covering the columns `[roleId,snapshotAt]` on the table `RoleRiskSnapshot` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "RoleRiskSnapshot_roleId_snapshotAt_key" ON "RoleRiskSnapshot"("roleId", "snapshotAt");
