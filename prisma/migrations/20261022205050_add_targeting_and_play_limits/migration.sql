/*
  Warnings:

  - A unique constraint covering the columns `[playKey]` on the table `Spin` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Spin" ADD COLUMN "customerId" TEXT;
ALTER TABLE "Spin" ADD COLUMN "playKey" TEXT;
ALTER TABLE "Spin" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "Spin" ADD COLUMN "visitorId" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rewardCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "triggerType" TEXT NOT NULL DEFAULT 'time_delay',
    "triggerDelaySeconds" INTEGER NOT NULL DEFAULT 3,
    "scrollDepthPercent" INTEGER NOT NULL DEFAULT 50,
    "displayFrequency" TEXT NOT NULL DEFAULT 'every_visit',
    "cooldownDays" INTEGER NOT NULL DEFAULT 7,
    "playLimit" TEXT NOT NULL DEFAULT 'unlimited',
    "deviceTarget" TEXT NOT NULL DEFAULT 'all'
);
INSERT INTO "new_Campaign" ("createdAt", "game", "id", "name", "placement", "rewardCount", "shop", "status", "theme", "updatedAt") SELECT "createdAt", "game", "id", "name", "placement", "rewardCount", "shop", "status", "theme", "updatedAt" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Spin_playKey_key" ON "Spin"("playKey");

-- CreateIndex
CREATE INDEX "Spin_campaignId_visitorId_idx" ON "Spin"("campaignId", "visitorId");

-- CreateIndex
CREATE INDEX "Spin_campaignId_sessionId_idx" ON "Spin"("campaignId", "sessionId");

-- CreateIndex
CREATE INDEX "Spin_campaignId_customerId_idx" ON "Spin"("campaignId", "customerId");
