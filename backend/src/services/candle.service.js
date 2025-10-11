import { prisma } from "../lib/prisma.js";

/**
 * 🕒 Ambil waktu candle terakhir yang tersimpan untuk simbol tertentu
 */
export async function getLastSavedCandleTime(symbol) {
  try {
    console.log(`🔍 Getting last saved candle time for ${symbol}...`);

    const last = await prisma.candle.findFirst({
      where: { symbol, timeframe: "1h" },
      orderBy: { time: "desc" },
      select: { time: true },
    });

    if (last) {
      const lastTime = new Date(Number(last.time));
      console.log(
        `📊 Found last candle for ${symbol}: ${lastTime.toISOString()} (${last.time})`
      );
    } else {
      console.log(`📊 No candles found for ${symbol}`);
    }

    return last?.time || null;
  } catch (err) {
    console.error(`❌ Error getLastSavedCandleTime(${symbol}):`, err.message);
    return null;
  }
}

/**
 * 💾 Simpan kumpulan candle ke database dengan aman
 * @param {string} symbol - Contoh: "BTC-USD"
 * @param {number|Array} coinIdOrCandles - Bisa `coinId` atau langsung array candle
 * @param {Array} [candles] - Array candle (hanya jika param ke-2 adalah coinId)
 * @returns {Promise<{success:boolean, count:number, message?:string}>}
 */
export async function saveCandles(symbol, coinIdOrCandles, candles) {
  try {
    let coinId = null;
    let candleData = [];

    // 🧩 Deteksi pola pemanggilan
    if (Array.isArray(coinIdOrCandles)) {
      // Bentuk lama: saveCandles(symbol, candles)
      candleData = coinIdOrCandles;
      const coin = await prisma.coin.findUnique({
        where: { symbol },
        select: { id: true },
      });
      if (!coin) {
        console.warn(`⚠️ Coin ${symbol} belum ada di tabel Coin.`);
        return {
          success: false,
          count: 0,
          message: `Coin ${symbol} not found`,
        };
      }
      coinId = coin.id;
    } else {
      // Bentuk baru: saveCandles(symbol, coinId, candles)
      coinId = coinIdOrCandles;
      candleData = candles;
    }

    if (!Array.isArray(candleData) || candleData.length === 0) {
      console.warn(`⚠️ Tidak ada candle untuk ${symbol}, lewati penyimpanan.`);
      return { success: false, count: 0 };
    }

    // Validasi struktur data candle
    const invalidCandles = candleData.filter(
      (c) =>
        !c.time ||
        typeof c.time !== "number" ||
        typeof c.open !== "number" ||
        typeof c.high !== "number" ||
        typeof c.low !== "number" ||
        typeof c.close !== "number" ||
        typeof c.volume !== "number"
    );

    if (invalidCandles.length > 0) {
      console.error(
        `❌ ${symbol}: ${invalidCandles.length} candle memiliki data tidak valid`
      );
      return {
        success: false,
        count: 0,
        message: `Invalid candle data structure`,
      };
    }

    console.log(
      `💾 Saving ${candleData.length} candles for ${symbol} (coinId: ${coinId})`
    );

    const formattedCandles = candleData.map((c) => ({
      symbol,
      timeframe: "1h",
      time: BigInt(c.time * 1000), // Coinbase API: detik → simpan ms BigInt
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      coinId,
    }));

    // Test database connection before attempting to save
    await prisma.$queryRaw`SELECT 1`;

    const result = await prisma.candle.createMany({
      data: formattedCandles,
      skipDuplicates: true,
    });

    const count = result.count || 0;
    console.log(
      `✅ ${symbol}: ${count}/${formattedCandles.length} candle tersimpan ke database`
    );

    if (count < formattedCandles.length) {
      console.log(
        `ℹ️ ${symbol}: ${formattedCandles.length - count} candle diabaikan (duplikat)`
      );
    }

    return { success: true, count };
  } catch (err) {
    console.error(`❌ Gagal menyimpan candle ${symbol}:`, err.message);
    console.error(`Stack trace:`, err.stack);

    // Check if it's a database connection error
    if (err.message.includes("connection") || err.code === "P1001") {
      console.error(`🔌 Database connection error untuk ${symbol}`);
    }

    return { success: false, count: 0, message: err.message };
  }
}

/**
 * 🔢 Hitung jumlah candle tersimpan untuk simbol tertentu
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

    return candles.reverse().map((c) => ({
      time: Math.floor(Number(c.time) / 1000),
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
