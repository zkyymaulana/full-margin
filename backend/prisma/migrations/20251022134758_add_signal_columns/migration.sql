-- AlterTable
ALTER TABLE "Indicator" ADD COLUMN     "bbSignal" TEXT,
ADD COLUMN     "emaSignal" TEXT,
ADD COLUMN     "macdSignalLine" DOUBLE PRECISION,
ADD COLUMN     "overallSignal" TEXT,
ADD COLUMN     "psarSignal" TEXT,
ADD COLUMN     "rsiSignal" TEXT,
ADD COLUMN     "signalStrength" DOUBLE PRECISION,
ADD COLUMN     "smaSignal" TEXT,
ADD COLUMN     "stochRsiSignal" TEXT,
ADD COLUMN     "stochSignal" TEXT,
ALTER COLUMN "macdSignal" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "Indicator_symbol_timeframe_time_idx" ON "Indicator"("symbol", "timeframe", "time");

-- CreateIndex
CREATE INDEX "Indicator_overallSignal_idx" ON "Indicator"("overallSignal");
