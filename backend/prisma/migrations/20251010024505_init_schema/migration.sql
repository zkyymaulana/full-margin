-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coin" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candle" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "time" BIGINT NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "coinId" INTEGER,

    CONSTRAINT "Candle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "indicator" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopCoin" (
    "id" SERIAL NOT NULL,
    "rank" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "marketCap" DOUBLE PRECISION NOT NULL,
    "volume24h" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopCoin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Coin_symbol_key" ON "Coin"("symbol");

-- CreateIndex
CREATE INDEX "Candle_symbol_time_idx" ON "Candle"("symbol", "time");

-- CreateIndex
CREATE UNIQUE INDEX "Candle_symbol_timeframe_time_key" ON "Candle"("symbol", "timeframe", "time");

-- CreateIndex
CREATE UNIQUE INDEX "TopCoin_symbol_key" ON "TopCoin"("symbol");

-- AddForeignKey
ALTER TABLE "Candle" ADD CONSTRAINT "Candle_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
