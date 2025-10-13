-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLogin" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AuthLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Indicator" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL DEFAULT '1h',
    "time" BIGINT NOT NULL,
    "sma20" DOUBLE PRECISION,
    "ema20" DOUBLE PRECISION,
    "rsi" DOUBLE PRECISION,
    "macd" DOUBLE PRECISION,
    "macdSignal" DOUBLE PRECISION,
    "macdHist" DOUBLE PRECISION,
    "bbUpper" DOUBLE PRECISION,
    "bbLower" DOUBLE PRECISION,
    "stochK" DOUBLE PRECISION,
    "stochD" DOUBLE PRECISION,
    "stochRsiK" DOUBLE PRECISION,
    "stochRsiD" DOUBLE PRECISION,
    "psar" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Indicator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Indicator_symbol_time_idx" ON "Indicator"("symbol", "time");

-- CreateIndex
CREATE UNIQUE INDEX "Indicator_symbol_timeframe_time_key" ON "Indicator"("symbol", "timeframe", "time");

-- AddForeignKey
ALTER TABLE "AuthLog" ADD CONSTRAINT "AuthLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
