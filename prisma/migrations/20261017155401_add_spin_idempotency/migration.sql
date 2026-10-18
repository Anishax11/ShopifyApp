/*
  Warnings:

  - A unique constraint covering the columns `[shop,idempotencyKey]` on the table `Spin` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Spin" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Spin_shop_idempotencyKey_key" ON "Spin"("shop", "idempotencyKey");
