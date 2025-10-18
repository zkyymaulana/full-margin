/*
  Warnings:

  - You are about to drop the column `ema5` on the `Indicator` table. All the data in the column will be lost.
  - You are about to drop the column `sma5` on the `Indicator` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Indicator" DROP COLUMN "ema5",
DROP COLUMN "sma5",
ADD COLUMN     "ema50" DOUBLE PRECISION;
