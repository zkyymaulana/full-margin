// src/controllers/candle.controller.js
import { PrismaClient } from "@prisma/client";
import { fetchHistoricalCandles } from "../services/coinbase.service.js";

const prisma = new PrismaClient();

/**
 * Sinkronisasi semua candle historis ke database
 * @param {string} symbol contoh: "BTC-USD"
 */
export async function syncCoinbaseCandles(symbol = "BTC-USD") {
  try {
    const startTime = new Date("2020-10-01T00:00:00Z").getTime();
    const endTime = new Date().getTime();

    console.log(`🚀 Mengambil data ${symbol} dari Coinbase...`);
    const candles = await fetchHistoricalCandles(symbol, startTime, endTime);

    if (!candles.length) {
      console.warn(`⚠️ Tidak ada data candle untuk ${symbol}`);
      return { success: false, message: "Tidak ada data candle" };
    }

    console.log(`💾 Menyimpan ${candles.length} candle ke database...`);

    // Pastikan coin-nya sudah ada
    const [baseSymbol] = symbol.split("-");
    const savedCoin = await prisma.coin.upsert({
      where: { symbol: baseSymbol },
      update: {},
      create: { symbol: baseSymbol, name: baseSymbol },
    });

    // Konversi ke format Prisma
    const formattedCandles = candles.map((c) => ({
      symbol,
      timeframe: "1h",
      time: BigInt(c.time * 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      coinId: savedCoin.id,
    }));

    // Simpan batch per 500 biar gak timeout
    for (let i = 0; i < formattedCandles.length; i += 500) {
      const batch = formattedCandles.slice(i, i + 500);
      await prisma.candle.createMany({
        data: batch,
        skipDuplicates: true,
      });
      console.log(`✅ Batch ${i / 500 + 1}: ${batch.length} candle tersimpan`);
    }

    console.log(
      `🎉 Selesai! Total ${candles.length} candle ${symbol} disimpan`
    );
    return {
      success: true,
      total: candles.length,
      coin: symbol,
      first: new Date(candles[0].time * 1000).toISOString(),
      last: new Date(candles.at(-1).time * 1000).toISOString(),
    };
  } catch (err) {
    console.error(`❌ Gagal sinkronisasi ${symbol}:`, err.message);
    return { success: false, message: err.message };
  } finally {
    await prisma.$disconnect();
  }
}
