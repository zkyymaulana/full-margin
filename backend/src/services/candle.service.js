// src/services/candle.service.js
// Mengatur operasi pada tabel Candle: menyimpan candle (createMany), mengambil candle terakhir (findFirst), dll.
import { prisma } from "../lib/prisma.js";

/**
 * 🕒 Ambil waktu candle terakhir yang tersimpan untuk simbol tertentu
 * @param {string} symbol - Contoh: "BTC-USD"
 * @returns {bigint|null} Waktu terakhir dalam milidetik (BigInt)
 */
export async function getLastSavedCandleTime(symbol) {
  try {
    const last = await prisma.candle.findFirst({
      where: { symbol, timeframe: "1h" },
      orderBy: { time: "desc" },
      select: { time: true },
    });
    return last?.time || null;
  } catch (err) {
    console.error(`❌ Error getLastSavedCandleTime(${symbol}):`, err.message);
    return null;
  }
}

/**
 * 💾 Simpan kumpulan candle ke database dengan aman
 * @param {string} symbol - Contoh: "BTC-USD"
 * @param {Array} candles - Array candle dari API { time, open, high, low, close, volume }
 * @returns {Object} { success: boolean, count?: number, message?: string }
 */
export async function saveCandles(symbol, candles) {
  if (!candles?.length) {
    return { success: false, message: "No candles to save" };
  }

  try {
    // Pastikan coin tersedia di database
    const coin = await prisma.coin.findUnique({
      where: { symbol },
      select: { id: true },
    });

    if (!coin) {
      console.warn(`⚠️ Coin ${symbol} belum ada di tabel Coin.`);
      return { success: false, message: `Coin ${symbol} not found` };
    }

    // Format data sesuai struktur Prisma
    const formattedCandles = candles.map((c) => ({
      symbol,
      timeframe: "1h",
      time: BigInt(c.time * 1000), // convert seconds → ms BigInt
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      coinId: coin.id,
    }));

    // Simpan dalam batch besar (gunakan skipDuplicates agar efisien)
    const result = await prisma.candle.createMany({
      data: formattedCandles,
      skipDuplicates: true,
    });

    console.log(`✅ ${symbol}: ${result.count} candle tersimpan ke database`);
    return { success: true, count: result.count };
  } catch (err) {
    console.error(`❌ Gagal menyimpan candle ${symbol}:`, err.message);
    return { success: false, message: err.message };
  }
}

/**
 * 🔢 Hitung jumlah candle tersimpan untuk simbol tertentu
 * @param {string} symbol
 * @returns {Promise<number>} Jumlah total candle
 */
export async function getCandleCount(symbol) {
  try {
    return await prisma.candle.count({
      where: { symbol, timeframe: "1h" },
    });
  } catch (err) {
    console.error(`❌ Error getCandleCount(${symbol}):`, err.message);
    return 0;
  }
}

/**
 * 📈 Ambil N candle terakhir dari DB (urut ascending untuk chart)
 * @param {string} symbol - Contoh: "BTC-USD"
 * @param {number} limit - Batas jumlah candle (default 500)
 * @returns {Promise<Array>} Array candle {time, open, high, low, close, volume}
 */
export async function getRecentCandlesFromDB(symbol, limit = 500) {
  try {
    const candles = await prisma.candle.findMany({
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

    // Kembalikan dalam urutan dari lama → baru
    return candles.reverse().map((c) => ({
      time: Math.floor(Number(c.time) / 1000), // ubah ke detik
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
  } catch (err) {
    console.error(`❌ Error getRecentCandlesFromDB(${symbol}):`, err.message);
    return [];
  }
}
