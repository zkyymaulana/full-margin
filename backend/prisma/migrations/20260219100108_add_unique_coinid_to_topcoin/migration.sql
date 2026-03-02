/*
  Warnings:

  - A unique constraint covering the columns `[coinId]` on the table `TopCoin` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TopCoin_coinId_key" ON "TopCoin"("coinId");
