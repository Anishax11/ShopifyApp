-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CampaignReward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "reward" TEXT NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'percentage',
    "discountValue" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "CampaignReward_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CampaignReward" ("campaignId", "id", "reward") SELECT "campaignId", "id", "reward" FROM "CampaignReward";
DROP TABLE "CampaignReward";
ALTER TABLE "new_CampaignReward" RENAME TO "CampaignReward";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
