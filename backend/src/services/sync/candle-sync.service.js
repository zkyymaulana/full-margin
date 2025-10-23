import { prisma } from "../../lib/prisma.js";
import { fetchHistoricalCandles } from "../coinbase/coinbase.service.js";

// Cache untuk tracking last update time per symbol
const lastUpdateCache = new Map();

export async function syncLatestCandles(symbols = []) {
  console.log(`🕐 Starting candle sync for ${symbols.length} symbols...`);
  const start = Date.now();

  try {
    const results = await Promise.allSettled(
      symbols.map((symbol) => syncSymbolCandles(symbol))
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(
      `✅ Candle sync completed: ${successful} success, ${failed} failed (${Date.now() - start}ms)`
    );
    return { successful, failed, duration: Date.now() - start };
  } catch (error) {
    console.error(`❌ Candle sync error:`, error.message);
    throw error;
  }
}

async function syncSymbolCandles(symbol) {
  try {
    // Get last candle time from database
    const lastCandle = await prisma.candle.findFirst({
      where: { symbol, timeframe: "1h" },
      orderBy: { time: "desc" },
    });

    // Calculate start time for fetch (last candle + 1 hour or 7 days ago)
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    let startTime;
    if (lastCandle) {
      // ✅ Handle BigInt timestamp properly
      const lastCandleTime =
        lastCandle.time instanceof Date
          ? lastCandle.time.getTime()
          : Number(lastCandle.time);
      startTime = lastCandleTime + oneHour;
    } else {
      startTime = now - sevenDays; // Get last 7 days if no data
    }

    // Don't fetch if we're already up to date
    const currentHour = Math.floor(now / oneHour) * oneHour;
    if (startTime >= currentHour) {
      console.log(`⏭️ ${symbol}: Already up to date`);
      return { symbol, newCandles: 0 };
    }

    // Fetch new candles from Coinbase
    const newCandles = await fetchHistoricalCandles(symbol, startTime, now);

    if (newCandles.length === 0) {
      console.log(`📭 ${symbol}: No new candles`);
      return { symbol, newCandles: 0 };
    }

    // Filter only complete hourly candles (exclude current incomplete hour)
    const completeCandles = newCandles.filter((candle) => {
      const candleHour = Math.floor(candle.time / oneHour) * oneHour;
      return candleHour < currentHour;
    });

    if (completeCandles.length === 0) {
      console.log(`⏳ ${symbol}: No complete candles to save`);
      return { symbol, newCandles: 0 };
    }

    // Prepare data for database insert - ensure BigInt for time field
    const candleData = completeCandles.map((candle) => ({
      symbol,
      timeframe: "1h",
      time: BigInt(Math.floor(candle.time)),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));

    // Batch insert with upsert to handle duplicates
    await prisma.candle.createMany({
      data: candleData,
      skipDuplicates: true,
    });

    // Update cache
    lastUpdateCache.set(symbol, now);

    console.log(`💾 ${symbol}: Saved ${candleData.length} new candles`);
    return { symbol, newCandles: candleData.length };
  } catch (error) {
    console.error(`❌ ${symbol}: Sync failed -`, error.message);
    throw error;
  }
}

export async function getActiveSymbols() {
  try {
    if (!prisma) {
      console.error("❌ Prisma client not available");
      return getDefaultSymbols();
    }

    // ✅ Ambil symbol dari tabel Coin dengan rank valid
    const coins = await prisma.coin.findMany({
      where: { rank: { not: null } },
      orderBy: { rank: "asc" },
      select: { symbol: true },
      take: 100,
    });

    const result = coins.map((c) => c.symbol).filter(Boolean);

    if (result.length === 0) {
      console.log("⚠️ No symbols found in database, using defaults");
      return getDefaultSymbols();
    }

    console.log(`✅ Found ${result.length} active symbols in database`);
    return result;
  } catch (error) {
    console.error("❌ Failed to get active symbols:", error.message);
    console.log("🔄 Using default symbols as fallback");
    return getDefaultSymbols();
  }
}

function getDefaultSymbols() {
  return [
    "BTC-USD",
    "ETH-USD",
    "ADA-USD",
    "SOL-USD",
    "XRP-USD",
    "DOGE-USD",
    "LINK-USD",
    "AVAX-USD",
    "DOT-USD",
    "UNI-USD",
    "LTC-USD",
    "BCH-USD",
    "XLM-USD",
    "AAVE-USD",
    "SHIB-USD",
  ];
}

export function getCacheStatus() {
  return {
    totalSymbols: lastUpdateCache.size,
    lastUpdates: Object.fromEntries(lastUpdateCache),
  };
}
