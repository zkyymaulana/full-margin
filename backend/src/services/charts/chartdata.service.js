import { prisma } from "../../lib/prisma.js";

/** 🔹 Ambil waktu candle terakhir untuk symbol */
export async function getLastCandleTime(symbol) {
  try {
    const last = await prisma.candle.findFirst({
      where: { symbol },
      orderBy: { time: "desc" },
      select: { time: true },
    });
    return last ? Number(last.time) : null;
  } catch (err) {
    console.error(`❌ getLastCandleTime error (${symbol}):`, err.message);
    return null;
  }
}

/** 🔹 Hitung total candle yang tersimpan untuk symbol tertentu */
export async function getCandleCount(symbol) {
  try {
    return await prisma.candle.count({
      where: { symbol, timeframe: "1h" },
    });
  } catch (err) {
    console.error(`❌ getCandleCount error (${symbol}):`, err.message);
    return 0;
  }
}

/** 🔹 Ambil candle dari DB dengan pagination */
export async function getChartData(symbol, limit = 500, offset = 0) {
  const total = await getCandleCount(symbol);
  const candles = await prisma.candle.findMany({
    where: { symbol, timeframe: "1h" },
    orderBy: { time: "asc" },
    skip: offset,
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

  // ✅ PERBAIKAN: Konsistensi format waktu untuk matching dengan indicator
  return {
    total,
    candles: candles.map((c) => ({
      time: c.time, // ✅ Gunakan format BigInt asli dari database
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    })),
  };
}

/** 🔹 Ambil candle dari DB dengan pagination - Data Terbaru Dulu */
export async function getChartDataNewest(symbol, limit = 1000, offset = 0) {
  const total = await getCandleCount(symbol);
  const candles = await prisma.candle.findMany({
    where: { symbol, timeframe: "1h" },
    orderBy: { time: "desc" }, // ✅ DESC untuk data terbaru dulu
    skip: offset,
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

  return {
    total,
    candles: candles.map((c) => ({
      time: c.time, // ✅ Gunakan format BigInt asli dari database
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    })),
  };
}

/** 🔹 Simpan candles ke DB (dipakai scheduler otomatis) */
export async function saveCandlesToDB(symbol, coinId, candles) {
  try {
    if (!candles?.length) return { success: false, message: "No candles" };

    const data = candles.map((c) => ({
      symbol,
      timeframe: "1h",
      time: BigInt(c.time), // ✅ PERBAIKAN: Langsung gunakan milidetik dari candle.time
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      coinId,
    }));

    await prisma.candle.createMany({ data, skipDuplicates: true });
    console.log(`💾 ${symbol}: ${data.length} candle disimpan`);
    return { success: true, count: data.length };
  } catch (err) {
    console.error(`❌ saveCandlesToDB error (${symbol}):`, err.message);
    return { success: false, message: err.message };
  }
}
