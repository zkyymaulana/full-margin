/*
  Warnings:

  - Added the required column `finalCapital` to the `IndicatorWeight` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: Add columns as nullable first
ALTER TABLE "IndicatorWeight" ADD COLUMN "finalCapital" DOUBLE PRECISION;
ALTER TABLE "IndicatorWeight" ADD COLUMN "sharpeRatio" DOUBLE PRECISION;

-- Step 2: Set default values for existing records (assume 10000 initial capital)
UPDATE "IndicatorWeight" SET "finalCapital" = 10000 * (1 + (roi / 100)) WHERE "finalCapital" IS NULL;

-- Step 3: Make finalCapital NOT NULL
ALTER TABLE "IndicatorWeight" ALTER COLUMN "finalCapital" SET NOT NULL;

-- Step 4: Remove defaults from other columns
ALTER TABLE "IndicatorWeight" ALTER COLUMN "maxDrawdown" DROP DEFAULT;
ALTER TABLE "IndicatorWeight" ALTER COLUMN "trades" DROP DEFAULT;
