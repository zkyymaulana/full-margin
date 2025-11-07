import { prisma } from "../lib/prisma.js";

/**
 * Ambil data indikator dan candle terbaru.
 */
export async function fetchLatestIndicatorData(symbol, timeframe = "1h") {
  const [indicator, prevIndicator, candle] = await Promise.all([
    prisma.indicator.findFirst({
      where: { symbol, timeframe },
      orderBy: { time: "desc" },
    }),
    prisma.indicator.findFirst({
      where: { symbol, timeframe },
      orderBy: { time: "desc" },
      skip: 1,
    }),
    prisma.candle.findFirst({
      where: { symbol, timeframe },
      orderBy: { time: "desc" },
    }),
  ]);
  return { indicator, prevIndicator, candle };
}
