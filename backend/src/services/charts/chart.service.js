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

// Ambil timestamp candle terakhir untuk satu simbol.
// Fungsi ini dipakai untuk sinkronisasi incremental agar tidak re-sync dari awal.
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

// Hitung total candle pada timeframe 1h untuk simbol tertentu.
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

// Ambil data candle dengan urutan waktu lama ke baru (oldest first).
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

// Ambil data candle dengan urutan terbaru ke lama (newest first).
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

// Simpan batch candle baru ke database dengan skipDuplicates.
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
