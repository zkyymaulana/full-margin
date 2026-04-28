import { prisma } from "../../lib/prisma.js";

// File repository indikator.
// Tujuan: memusatkan semua query Prisma agar layer service fokus ke orkestrasi bisnis.

const INDICATOR_SELECT = {
  time: true,
  sma20: true,
  sma50: true,
  ema20: true,
  ema50: true,
  rsi: true,
  macd: true,
  macdSignalLine: true,
  macdHist: true,
  bbUpper: true,
  bbMiddle: true,
  bbLower: true,
  stochK: true,
  stochD: true,
  stochRsiK: true,
  stochRsiD: true,
  psar: true,
  smaSignal: true,
  emaSignal: true,
  rsiSignal: true,
  macdSignal: true,
  bbSignal: true,
  stochSignal: true,
  stochRsiSignal: true,
  psarSignal: true,
  overallSignal: true,
  signalStrength: true,
  finalScore: true,
};

export async function findCoinBySymbolWithListing(symbol) {
  return prisma.coin.findUnique({
    where: { symbol },
    select: { id: true, listingDate: true },
  });
}

export async function findCoinIdBySymbol(symbol) {
  return prisma.coin.findUnique({
    where: { symbol },
    select: { id: true },
  });
}

export async function findTimeframeByValue(timeframe) {
  return prisma.timeframe.findUnique({
    where: { timeframe },
    select: { id: true },
  });
}

export async function findLatestIndicatorTime(coinId, timeframeId) {
  return prisma.indicator.findFirst({
    where: { coinId, timeframeId },
    orderBy: { time: "desc" },
    select: { time: true },
  });
}

export async function findCandlesAsc(coinId, timeframeId) {
  return prisma.candle.findMany({
    where: { coinId, timeframeId },
    orderBy: { time: "asc" },
  });
}

export async function findCandlesAscFromTime(coinId, timeframeId, rangeStart) {
  return prisma.candle.findMany({
    where: {
      coinId,
      timeframeId,
      time: { gte: BigInt(rangeStart) },
    },
    orderBy: { time: "asc" },
  });
}

export async function findIndicatorTimes(coinId, timeframeId) {
  return prisma.indicator.findMany({
    where: { coinId, timeframeId },
    select: { time: true },
  });
}

export async function createManyIndicators(data) {
  return prisma.indicator.createMany({
    data,
    skipDuplicates: true,
  });
}

export async function pingDatabase() {
  return prisma.$queryRaw`SELECT 1`;
}

export async function findLatestWeightRecord(
  coinId,
  timeframeId,
  select = null,
) {
  return prisma.indicatorWeight.findFirst({
    where: { coinId, timeframeId },
    orderBy: { updatedAt: "desc" },
    ...(select ? { select } : {}),
  });
}

export async function findLatestSignalDataBundle(coinId, timeframeId) {
  const [latestIndicator, latestWeight, latestCandle] = await Promise.all([
    prisma.indicator.findFirst({
      where: { coinId, timeframeId },
      orderBy: { time: "desc" },
    }),
    prisma.indicatorWeight.findFirst({
      where: { coinId, timeframeId },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.candle.findFirst({
      where: { coinId, timeframeId },
      orderBy: { time: "desc" },
      select: { time: true, close: true },
    }),
  ]);

  return {
    latestIndicator,
    latestWeight,
    latestCandle,
  };
}

export async function findPaginatedIndicators(
  coinId,
  timeframeId,
  page,
  limit,
  showAll,
) {
  const skip = (page - 1) * limit;

  const queryOptions = {
    where: { coinId, timeframeId },
    orderBy: { time: "desc" },
    select: INDICATOR_SELECT,
  };

  if (!showAll) {
    queryOptions.skip = skip;
    queryOptions.take = limit;
  }

  return prisma.indicator.findMany(queryOptions);
}

export async function findPaginatedCandlePrices(
  coinId,
  timeframeId,
  page,
  limit,
  showAll,
) {
  const skip = (page - 1) * limit;

  return prisma.candle.findMany({
    where: { coinId, timeframeId },
    orderBy: { time: "desc" },
    ...(showAll ? {} : { skip, take: limit }),
    select: { time: true, close: true },
  });
}

export async function countIndicators(coinId, timeframeId) {
  return prisma.indicator.count({
    where: { coinId, timeframeId },
  });
}

export async function findPaginatedSignalDataBundle(
  coinId,
  timeframeId,
  page,
  limit,
  showAll,
) {
  const [data, candlePrices, latestIndicator, latestWeight] = await Promise.all(
    [
      findPaginatedIndicators(coinId, timeframeId, page, limit, showAll),
      findPaginatedCandlePrices(coinId, timeframeId, page, limit, showAll),
      prisma.indicator.findFirst({
        where: { coinId, timeframeId },
        orderBy: { time: "desc" },
      }),
      prisma.indicatorWeight.findFirst({
        where: { coinId, timeframeId },
        orderBy: { updatedAt: "desc" },
      }),
    ],
  );

  return {
    indicators: data,
    prices: candlePrices,
    latestIndicator,
    latestWeight,
  };
}
