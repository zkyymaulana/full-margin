-- Rename training window columns to test window naming
ALTER TABLE "IndicatorWeight"
RENAME COLUMN "startTrain" TO "startTest";

ALTER TABLE "IndicatorWeight"
RENAME COLUMN "endTrain" TO "endTest";

-- Keep index name aligned with renamed columns
ALTER INDEX "IndicatorWeight_coinId_timeframeId_startTrain_endTrain_key"
RENAME TO "IndicatorWeight_coinId_timeframeId_startTest_endTest_key";
