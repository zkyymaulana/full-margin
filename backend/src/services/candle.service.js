import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/** Ambil waktu candle terakhir yang tersimpan (BigInt) */
export async function getLastSavedCandleTime(symbol) {
  const last = await prisma.candle.findFirst({
    where: { symbol, timeframe: "1h" },
    orderBy: { time: "desc" },
    select: { time: true },
  });
  return last?.time || null;
}

/** Simpan candle ke database (dengan coinId otomatis) */
export async function saveCandles(symbol, candles) {
  if (!candles.length) return { success: false, message: "No candles to save" };

  try {
    // pastikan coin ada
    const coin = await prisma.coin.findUnique({
      where: { symbol },
      select: { id: true },
    });
    if (!coin) {
      console.warn(`⚠️ Coin ${symbol} belum ada di tabel Coin, dilewati.`);
      return { success: false, message: `Coin ${symbol} not found` };
    }

    const formatted = candles.map((c) => ({
      symbol,
      timeframe: "1h",
      time: BigInt(c.time * 1000), // simpan ms sebagai BigInt
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      coinId: coin.id,
    }));

    const result = await prisma.candle.createMany({
      data: formatted,
      skipDuplicates: true,
    });

    console.log(
      `💾 ${formatted.length} candle ${symbol} disiapkan, tersimpan: ${result.count}.`
    );
    return { success: true, count: result.count };
  } catch (err) {
    console.error(`❌ Gagal menyimpan candle ${symbol}:`, err.message);
    return { success: false, message: err.message };
  }
}

/** Hitung jumlah candle tersimpan untuk symbol tertentu */
export async function getCandleCount(symbol) {
  return prisma.candle.count({ where: { symbol, timeframe: "1h" } });
}

/** 🔹 Ambil N candle terakhir dari DB (ascending, siap pakai untuk chart) */
export async function getRecentCandlesFromDB(symbol, limit = 500) {
  const rows = await prisma.candle.findMany({
    where: { symbol, timeframe: "1h" },
    orderBy: { time: "desc" },
    take: limit,
    select: {
      time: true,
      open: true,
      high: true,
      low: true,
      close: true,
      volume: true,
    },
  });

  // ubah ke ascending + ubah BigInt ms -> seconds (Lightweight Charts)
  return rows.reverse().map((r) => ({
    time: Math.floor(Number(r.time) / 1000),
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
  }));
}
