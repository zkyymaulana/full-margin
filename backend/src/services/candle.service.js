import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Ambil waktu candle terakhir yang tersimpan (BigInt)
 */
export async function getLastSavedCandleTime(symbol) {
  const last = await prisma.candle.findFirst({
    where: { symbol },
    orderBy: { time: "desc" },
    select: { time: true },
  });
  return last?.time || null;
}

/**
 * Simpan candle ke database
 */
export async function saveCandles(symbol, candles) {
  if (!candles.length) return { success: false, message: "No candles to save" };

  const formatted = candles.map((c) => ({
    symbol,
    timeframe: "1h",
    time: BigInt(c.time * 1000),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));

  try {
    const result = await prisma.candle.createMany({
      data: formatted,
      skipDuplicates: true,
    });

    console.log(`💾 ${formatted.length} candle ${symbol} disimpan.`);
    return { success: true, count: result.count };
  } catch (err) {
    console.error(`❌ Gagal menyimpan candle ${symbol}:`, err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Hitung jumlah candle yang sudah tersimpan untuk symbol tertentu
 * Gunanya untuk menentukan apakah perlu full sync atau tidak
 */
export async function getCandleCount(symbol) {
  const count = await prisma.candle.count({
    where: { symbol },
  });
  return count;
}
