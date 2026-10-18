/*
  Warnings:

  - A unique constraint covering the columns `[requestedDiscountCode]` on the table `Spin` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Spin" ADD COLUMN "requestedDiscountCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Spin_requestedDiscountCode_key" ON "Spin"("requestedDiscountCode");
