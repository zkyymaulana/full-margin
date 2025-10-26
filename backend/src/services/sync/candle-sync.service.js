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
    // Get coinId from Coin table
    const coin = await prisma.coin.findUnique({
      where: { symbol },
      select: { id: true },
    });

    if (!coin) {
      console.log(`⚠️ ${symbol}: Coin not found in database, skipping...`);
      return { symbol, newCandles: 0 };
    }

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

    // Prepare data for database insert - ensure BigInt for time field and include coinId
    const candleData = completeCandles.map((candle) => ({
      symbol,
      timeframe: "1h",
      time: BigInt(Math.floor(candle.time)),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      coinId: coin.id, // ✅ Add coinId
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

export async function syncHistoricalData(
  symbols = [],
  startDate = "2020-01-01"
) {
  console.log(`📚 Starting FAST historical data sync from ${startDate}...`);
  console.log(`📊 Processing ${symbols.length} symbols...`);

  const targetStartTime = new Date(startDate).getTime();
  const currentTime = Date.now();
  const totalDuration = Date.now();

  const results = {
    successful: 0,
    failed: 0,
    totalCandles: 0,
    skipped: 0,
    errors: [],
  };

  // Process symbols one by one to avoid overwhelming the API
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    console.log(`\n[${i + 1}/${symbols.length}] ${symbol}...`);

    try {
      // Get coinId from Coin table
      const coin = await prisma.coin.findUnique({
        where: { symbol },
        select: { id: true },
      });

      if (!coin) {
        console.log(`⚠️ Coin not found in database`);
        results.failed++;
        results.errors.push({ symbol, error: "Coin not found" });
        continue;
      }

      // Quick check: Get ONLY newest candle time
      const newestCandle = await prisma.candle.findFirst({
        where: { symbol, timeframe: "1h" },
        orderBy: { time: "desc" },
        select: { time: true },
      });

      const oneHour = 60 * 60 * 1000;
      const currentHour = Math.floor(currentTime / oneHour) * oneHour;
      let fetchStartTime;
      let fetchEndTime = currentTime;

      if (!newestCandle) {
        // No data - fetch everything from start date
        fetchStartTime = targetStartTime;
        console.log(`📥 Fetching from ${startDate} to now`);
      } else {
        // Has data - fetch from last candle onwards
        const newestTime =
          newestCandle.time instanceof Date
            ? newestCandle.time.getTime()
            : Number(newestCandle.time);

        fetchStartTime = newestTime + oneHour; // Start after last candle

        // Check if already up to date
        if (fetchStartTime >= currentHour) {
          console.log(`✅ Already up to date`);
          results.skipped++;
          continue;
        }

        console.log(
          `📥 Fetching from ${new Date(fetchStartTime).toISOString().split("T")[0]} onwards`
        );
      }

      // Fetch data
      const candles = await fetchHistoricalCandles(
        symbol,
        fetchStartTime,
        fetchEndTime
      );

      if (candles.length === 0) {
        console.log(`⚠️ No data available from API`);
        results.skipped++;
        continue;
      }

      // Filter complete candles
      const completeCandles = candles.filter((candle) => {
        const candleHour = Math.floor(candle.time / oneHour) * oneHour;
        return candleHour < currentHour;
      });

      if (completeCandles.length === 0) {
        console.log(`⚠️ No complete candles`);
        results.skipped++;
        continue;
      }

      // Save to database
      const candleData = completeCandles.map((candle) => ({
        symbol,
        timeframe: "1h",
        time: BigInt(Math.floor(candle.time)),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        coinId: coin.id,
      }));

      await prisma.candle.createMany({
        data: candleData,
        skipDuplicates: true,
      });

      results.successful++;
      results.totalCandles += candleData.length;

      const dateRange = `${new Date(completeCandles[0].time).toISOString().split("T")[0]} → ${new Date(completeCandles[completeCandles.length - 1].time).toISOString().split("T")[0]}`;
      console.log(`✅ Saved ${candleData.length} candles (${dateRange})`);

      // Delay between symbols
      if (i < symbols.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      results.failed++;
      results.errors.push({ symbol, error: error.message });
      console.error(`❌ ${symbol}: ${error.message}`);
      continue;
    }
  }

  const duration = Date.now() - totalDuration;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 SYNC SUMMARY:`);
  console.log(`   ✅ Updated: ${results.successful}/${symbols.length}`);
  console.log(`   ⏭️  Skipped: ${results.skipped}/${symbols.length}`);
  console.log(`   ❌ Failed: ${results.failed}/${symbols.length}`);
  console.log(`   💾 Total candles: ${results.totalCandles.toLocaleString()}`);
  console.log(`   ⏱️  Duration: ${(duration / 1000 / 60).toFixed(2)} minutes`);
  console.log(`${"=".repeat(60)}\n`);

  if (results.errors.length > 0 && results.errors.length <= 10) {
    console.log(`⚠️  Errors:`);
    results.errors.forEach(({ symbol, error }) => {
      console.log(`   - ${symbol}: ${error}`);
    });
  }

  return results;
}
