-- CreateTable
CREATE TABLE "IndicatorWeight" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "startTrain" BIGINT NOT NULL,
    "endTrain" BIGINT NOT NULL,
    "weights" JSONB NOT NULL,
    "roi" DOUBLE PRECISION NOT NULL,
    "winRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndicatorWeight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IndicatorWeight_symbol_timeframe_idx" ON "IndicatorWeight"("symbol", "timeframe");

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorWeight_symbol_timeframe_startTrain_endTrain_key" ON "IndicatorWeight"("symbol", "timeframe", "startTrain", "endTrain");
