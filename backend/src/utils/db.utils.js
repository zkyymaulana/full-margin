import { prisma } from "../lib/prisma.js";

// Ambil indikator terbaru, indikator sebelumnya, dan candle terbaru untuk satu simbol.
export async function fetchLatestIndicatorData(symbol, timeframe = "1h") {
  // Ambil pasangan coinId dan timeframeId lebih dulu.
  const ids = await getCoinAndTimeframeIds(symbol, timeframe);

  if (!ids) {
    return { indicator: null, prevIndicator: null, candle: null };
  }

  const { coinId, timeframeId } = ids;

  // Query dijalankan paralel agar lebih cepat.
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

  // Kembalikan satu paket data siap pakai untuk deteksi sinyal.
  return { indicator, prevIndicator, candle };
}

// Helper internal untuk mengambil coinId dan timeframeId.
async function getCoinAndTimeframeIds(symbol, timeframe = "1h") {
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
