import { prisma } from "../lib/prisma.js";

/**
 * Ambil data indikator dan candle terbaru.
 */
export async function fetchLatestIndicatorData(symbol, timeframe = "1h") {
  // Get coin and timeframe IDs
  const ids = await getCoinAndTimeframeIds(symbol, timeframe);

  if (!ids) {
    return { indicator: null, prevIndicator: null, candle: null };
  }

  const { coinId, timeframeId } = ids;

  const [indicator, prevIndicator, candle] = await Promise.all([
    prisma.indicator.findFirst({
      where: {
        coinId,
        timeframeId,
      },
      orderBy: { time: "desc" },
    }),
    prisma.indicator.findFirst({
      where: {
        coinId,
        timeframeId,
      },
      orderBy: { time: "desc" },
      skip: 1,
    }),
    prisma.candle.findFirst({
      where: {
        coinId,
        timeframeId,
      },
      orderBy: { time: "desc" },
    }),
  ]);
  return { indicator, prevIndicator, candle };
}

/**
 * Helper function to get coinId and timeframeId from symbol and timeframe
 * Returns null if not found
 */
export async function getCoinAndTimeframeIds(symbol, timeframe = "1h") {
  const [coin, timeframeRecord] = await Promise.all([
    prisma.coin.findUnique({
      where: { symbol },
      select: { id: true },
    }),
    prisma.timeframe.findUnique({
      where: { timeframe },
      select: { id: true },
    }),
  ]);

  if (!coin || !timeframeRecord) {
    return null;
  }

  return {
    coinId: coin.id,
    timeframeId: timeframeRecord.id,
  };
}
