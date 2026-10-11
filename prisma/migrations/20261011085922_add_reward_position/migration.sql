/*
  Warnings:

  - Added the required column `position` to the `CampaignReward` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CampaignReward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "reward" TEXT NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'percentage',
    "discountValue" REAL NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL,
    CONSTRAINT "CampaignReward_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CampaignReward" ("campaignId", "discountType", "discountValue", "id", "reward") SELECT "campaignId", "discountType", "discountValue", "id", "reward" FROM "CampaignReward";
DROP TABLE "CampaignReward";
ALTER TABLE "new_CampaignReward" RENAME TO "CampaignReward";
CREATE UNIQUE INDEX "CampaignReward_campaignId_position_key" ON "CampaignReward"("campaignId", "position");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
