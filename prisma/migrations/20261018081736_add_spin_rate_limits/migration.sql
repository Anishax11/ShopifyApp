-- CreateTable
CREATE TABLE "SpinRateLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "windowStart" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "SpinRateLimit_windowStart_idx" ON "SpinRateLimit"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "SpinRateLimit_shop_windowStart_key" ON "SpinRateLimit"("shop", "windowStart");
