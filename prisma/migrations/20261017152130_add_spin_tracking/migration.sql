-- CreateTable
CREATE TABLE "Spin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignRewardId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "discountCode" TEXT,
    "shopifyDiscountId" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Spin_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Spin_campaignRewardId_fkey" FOREIGN KEY ("campaignRewardId") REFERENCES "CampaignReward" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Spin_discountCode_key" ON "Spin"("discountCode");

-- CreateIndex
CREATE INDEX "Spin_shop_createdAt_idx" ON "Spin"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "Spin_campaignId_status_idx" ON "Spin"("campaignId", "status");
