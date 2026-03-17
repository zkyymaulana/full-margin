/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🕯️ CHART SERVICE - CANDLE DATA ACCESS & PERSISTENCE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * TUJUAN MODUL:
 * ─────────────
 * Modul ini menangani semua operasi terkait candle data dari database.
 * Tanggung jawab utama:
 * • Query candle dari database dengan pagination
 * • Hitung total candle untuk symbol tertentu
 * • Ambil waktu candle terakhir (untuk sync incremental)
 * • Simpan candle baru ke database (dari scheduler/API)
 * • Handle BigInt conversion untuk timestamp
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { prisma } from "../../lib/prisma.js";

/**
 * ⏰ Ambil waktu candle terakhir untuk symbol
 *
 * ────────────────────────────────────────────────────────────
 * Tujuan:
 * Mengambil timestamp candle terakhir untuk symbol tertentu.
 * Digunakan untuk incremental sync - ambil data baru hanya dari
 * waktu terakhir sampai sekarang, bukan re-sync semua data.
 *
 * Parameter:
 * @param {string} symbol - Cryptocurrency symbol (e.g., "BTC-USD")
 *
 * Return:
 * @returns {number|null} Timestamp candle terakhir dalam milidetik (BigInt)
 *                        atau null jika belum ada candle untuk symbol ini
 *
 * ────────────────────────────────────────────────────────────
 */
export async function getLastCandleTime(symbol) {
  try {
    // ✅ Query candle terakhir untuk symbol ini
    const last = await prisma.candle.findFirst({
      where: {
        coin: { symbol }, // Join dengan coin table
      },
      orderBy: { time: "desc" }, // Ambil yang paling baru
      select: { time: true }, // Hanya ambil field time
    });

    // Return timestamp atau null jika belum ada data
    return last ? Number(last.time) : null;
  } catch (err) {
    console.error(`❌ getLastCandleTime error (${symbol}):`, err.message);
    return null;
  }
}

/**
 * 🔢 Hitung total candle yang tersimpan untuk symbol tertentu
 *
 * ────────────────────────────────────────────────────────────
 * Tujuan:
 * Menghitung jumlah total candle untuk symbol dan timeframe tertentu.
 * Digunakan untuk:
 * • Pagination (berapa banyak halaman)
 * • Metadata (total data points dalam dataset)
 * • Coverage check (untuk auto-recalculation indicator)
 *
 * Parameter:
 * @param {string} symbol - Cryptocurrency symbol (e.g., "BTC-USD")
 *
 * Return:
 * @returns {number} Total jumlah candle untuk symbol ini dengan timeframe "1h"
 *
 * ────────────────────────────────────────────────────────────
 */
export async function getCandleCount(symbol) {
  try {
    // ✅ Query count candle untuk symbol + timeframe "1h"
    return await prisma.candle.count({
      where: {
        coin: { symbol }, // Filter by symbol
        timeframe: { timeframe: "1h" }, // Hanya timeframe 1h
      },
    });
  } catch (err) {
    console.error(`getCandleCount error (${symbol}):`, err.message);
    return 0;
  }
}

/**
 * 📊 Ambil candle dari DB dengan pagination (oldest first)
 *
 * ────────────────────────────────────────────────────────────
 * Tujuan:
 * Mengambil candle data dengan pagination, diurutkan dari
 * waktu terlama ke terbaru (ascending). Berguna untuk analisis
 * historical data yang membutuhkan urutan kronologis.
 *
 * Parameter:
 * @param {string} symbol - Cryptocurrency symbol (e.g., "BTC-USD")
 * @param {number} limit - Jumlah candle per halaman (default: 500)
 * @param {number} offset - Skip berapa banyak candle (untuk pagination)
 *
 * Return:
 * @returns {object} Object dengan struktur:
 *   {
 *     total: 5000,                  // Total candle untuk symbol ini
 *     candles: [
 *       {
 *         time: "1234567890000",    // BigInt dari database, as string
 *         open: 45000.50,
 *         high: 45500.00,
 *         low: 44800.25,
 *         close: 45300.75,
 *         volume: 125000.00
 *       },
 *       ...
 *     ]
 *   }
 *
 * ────────────────────────────────────────────────────────────
 */
export async function getChartData(symbol, limit = 500, offset = 0) {
  // ✅ Ambil total count terlebih dahulu
  const total = await getCandleCount(symbol);

  // ✅ Query candle dengan pagination, sorted ascending (oldest first)
  const candles = await prisma.candle.findMany({
    where: {
      coin: { symbol },
      timeframe: { timeframe: "1h" },
    },
    orderBy: { time: "asc" }, // Ascending = oldest first
    skip: offset, // Skip untuk pagination
    take: limit, // Ambil sebanyak limit
    select: {
      time: true,
      open: true,
      high: true,
      low: true,
      close: true,
      volume: true,
    },
  });

  // ✅ Return dengan format yang konsisten
  return {
    total,
    candles: candles.map((c) => ({
      time: c.time, // BigInt original dari database
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    })),
  };
}

/**
 * 📊 Ambil candle dari DB dengan pagination (newest first)
 *
 * ────────────────────────────────────────────────────────────
 * Tujuan:
 * Mengambil candle data dengan pagination, diurutkan dari
 * waktu terbaru ke terlama (descending). Default untuk chart display
 * di frontend karena users biasanya ingin lihat data terbaru dulu.
 *
 * Parameter:
 * @param {string} symbol - Cryptocurrency symbol (e.g., "BTC-USD")
 * @param {number} limit - Jumlah candle per halaman (default: 1000)
 * @param {number} offset - Skip berapa banyak candle (untuk pagination)
 *
 * Return:
 * @returns {object} Object dengan struktur:
 *   {
 *     total: 5000,                  // Total candle untuk symbol ini
 *     candles: [
 *       {
 *         time: "1234567890000",    // BigInt dari database, as string
 *         open: 45000.50,
 *         high: 45500.00,
 *         low: 44800.25,
 *         close: 45300.75,
 *         volume: 125000.00
 *       },
 *       ...
 *     ]
 *   }
 *
 * ────────────────────────────────────────────────────────────
 */
export async function getChartDataNewest(symbol, limit = 1000, offset = 0) {
  // ✅ Ambil total count terlebih dahulu
  const total = await getCandleCount(symbol);

  // ✅ Query candle dengan pagination, sorted descending (newest first)
  const candles = await prisma.candle.findMany({
    where: {
      coin: { symbol },
      timeframe: { timeframe: "1h" },
    },
    orderBy: { time: "desc" }, // Descending = newest first (default untuk UI)
    skip: offset, // Skip untuk pagination
    take: limit, // Ambil sebanyak limit
    select: {
      time: true,
      open: true,
      high: true,
      low: true,
      close: true,
      volume: true,
    },
  });

  // ✅ Return dengan format yang konsisten
  return {
    total,
    candles: candles.map((c) => ({
      time: c.time, // BigInt original dari database
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    })),
  };
}

/**
 * 💾 Simpan candles ke DB (dipakai scheduler otomatis)
 *
 * ────────────────────────────────────────────────────────────
 * Tujuan:
 * Menyimpan batch candle baru ke database dari scheduler atau
 * API call. Menggunakan createMany dengan skipDuplicates untuk
 * menghindari duplicate entries jika ada overlap waktu.
 *
 * Parameter:
 * @param {string} symbol - Cryptocurrency symbol (e.g., "BTC-USD")
 * @param {number} coinId - ID coin dari database
 * @param {Array} candles - Array of candle objects dari API dengan struktur:
 *   [
 *     { time: 1234567890000, open: 45000, high: 45500, low: 44800, close: 45300, volume: 125000 },
 *     ...
 *   ]
 *
 * Return:
 * @returns {object} Result object dengan struktur:
 *   {
 *     success: true,              // true jika berhasil
 *     count: 100,                 // Jumlah candle yang disimpan
 *     message: "..." (opsional)   // Error message jika gagal
 *   }
 *
 * Error handling:
 * • Tangani jika array candles kosong
 * • Tangani jika timeframe "1h" tidak ada di database
 * • Log error tapi jangan throw (scheduler harus tetap berjalan)
 *
 * ────────────────────────────────────────────────────────────
 */
export async function saveCandlesToDB(symbol, coinId, candles) {
  try {
    // ✅ Validasi - candle array harus tidak kosong
    if (!candles?.length) {
      return { success: false, message: "No candles" };
    }

    // ✅ Ambil timeframe ID untuk "1h"
    const timeframeRecord = await prisma.timeframe.findUnique({
      where: { timeframe: "1h" },
    });

    // ✅ Validasi - timeframe "1h" harus ada di database
    if (!timeframeRecord) {
      throw new Error('Timeframe "1h" not found in database');
    }

    // ✅ Transform candles menjadi format untuk database insert
    const data = candles.map((c) => ({
      coinId,
      timeframeId: timeframeRecord.id,
      time: BigInt(c.time), // Convert time ke BigInt untuk database
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));

    // ✅ Insert ke database dengan skipDuplicates
    // skipDuplicates menghindari error jika ada duplicate entries
    await prisma.candle.createMany({ data, skipDuplicates: true });

    console.log(`💾 ${symbol}: ${data.length} candle disimpan`);
    return { success: true, count: data.length };
  } catch (err) {
    console.error(`❌ saveCandlesToDB error (${symbol}):`, err.message);
    return { success: false, message: err.message };
  }
}
