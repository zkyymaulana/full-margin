-- CreateTable
CREATE TABLE "Timeframe" (
    "id" SERIAL NOT NULL,
    "timeframe" TEXT NOT NULL,

    CONSTRAINT "Timeframe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coin" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "rank" INTEGER,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candle" (
    "id" SERIAL NOT NULL,
    "coinId" INTEGER NOT NULL,
    "timeframeId" INTEGER NOT NULL,
    "time" BIGINT NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Candle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Indicator" (
    "id" SERIAL NOT NULL,
    "coinId" INTEGER NOT NULL,
    "timeframeId" INTEGER NOT NULL,
    "time" BIGINT NOT NULL,
    "sma20" DOUBLE PRECISION,
    "sma50" DOUBLE PRECISION,
    "ema20" DOUBLE PRECISION,
    "ema50" DOUBLE PRECISION,
    "rsi" DOUBLE PRECISION,
    "macd" DOUBLE PRECISION,
    "macdSignalLine" DOUBLE PRECISION,
    "macdHist" DOUBLE PRECISION,
    "bbUpper" DOUBLE PRECISION,
    "bbMiddle" DOUBLE PRECISION,
    "bbLower" DOUBLE PRECISION,
    "stochK" DOUBLE PRECISION,
    "stochD" DOUBLE PRECISION,
    "stochRsiK" DOUBLE PRECISION,
    "stochRsiD" DOUBLE PRECISION,
    "psar" DOUBLE PRECISION,
    "smaSignal" TEXT,
    "emaSignal" TEXT,
    "rsiSignal" TEXT,
    "macdSignal" TEXT,
    "bbSignal" TEXT,
    "stochSignal" TEXT,
    "stochRsiSignal" TEXT,
    "psarSignal" TEXT,
    "overallSignal" TEXT,
    "signalStrength" DOUBLE PRECISION,
    "finalScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Indicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicatorWeight" (
    "id" SERIAL NOT NULL,
    "coinId" INTEGER NOT NULL,
    "timeframeId" INTEGER NOT NULL,
    "startTrain" BIGINT NOT NULL,
    "endTrain" BIGINT NOT NULL,
    "weights" JSONB NOT NULL,
    "roi" DOUBLE PRECISION NOT NULL,
    "winRate" DOUBLE PRECISION NOT NULL,
    "maxDrawdown" DOUBLE PRECISION NOT NULL,
    "sharpeRatio" DOUBLE PRECISION NOT NULL,
    "trades" INTEGER NOT NULL,
    "finalCapital" DOUBLE PRECISION NOT NULL,
    "candleCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndicatorWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopCoin" (
    "id" SERIAL NOT NULL,
    "coinId" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "marketCap" DOUBLE PRECISION NOT NULL,
    "volume24h" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopCoin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLogin" TIMESTAMP(3),
    "avatarUrl" TEXT,
    "telegramChatId" TEXT,
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Timeframe_timeframe_key" ON "Timeframe"("timeframe");

-- CreateIndex
CREATE UNIQUE INDEX "Coin_symbol_key" ON "Coin"("symbol");

-- CreateIndex
CREATE INDEX "Candle_coinId_time_idx" ON "Candle"("coinId", "time");

-- CreateIndex
CREATE UNIQUE INDEX "Candle_coinId_timeframeId_time_key" ON "Candle"("coinId", "timeframeId", "time");

-- CreateIndex
CREATE INDEX "Indicator_coinId_time_idx" ON "Indicator"("coinId", "time");

-- CreateIndex
CREATE INDEX "Indicator_overallSignal_idx" ON "Indicator"("overallSignal");

-- CreateIndex
CREATE UNIQUE INDEX "Indicator_coinId_timeframeId_time_key" ON "Indicator"("coinId", "timeframeId", "time");

-- CreateIndex
CREATE INDEX "IndicatorWeight_coinId_timeframeId_idx" ON "IndicatorWeight"("coinId", "timeframeId");

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorWeight_coinId_timeframeId_startTrain_endTrain_key" ON "IndicatorWeight"("coinId", "timeframeId", "startTrain", "endTrain");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Candle" ADD CONSTRAINT "Candle_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candle" ADD CONSTRAINT "Candle_timeframeId_fkey" FOREIGN KEY ("timeframeId") REFERENCES "Timeframe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_timeframeId_fkey" FOREIGN KEY ("timeframeId") REFERENCES "Timeframe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorWeight" ADD CONSTRAINT "IndicatorWeight_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorWeight" ADD CONSTRAINT "IndicatorWeight_timeframeId_fkey" FOREIGN KEY ("timeframeId") REFERENCES "Timeframe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopCoin" ADD CONSTRAINT "TopCoin_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthLog" ADD CONSTRAINT "AuthLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
