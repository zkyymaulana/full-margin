import { prisma } from "../../lib/prisma.js";
import { sendSignalToWatchers } from "../telegram/telegram.service.js";
import {
  calculateIndividualSignals,
  calculateMultiIndicatorScore,
} from "../../utils/indicator.utils.js";
import { fetchLatestIndicatorData } from "../../utils/db.utils.js";
import { backtestWithWeights } from "../multiIndicator/index.js";

// Batas paralel proses deteksi sinyal.
const parsedSignalConcurrency = Number.parseInt(
  process.env.SIGNAL_DETECTION_CONCURRENCY || "1",
  10,
);
const SIGNAL_DETECTION_CONCURRENCY = Number.isFinite(parsedSignalConcurrency)
  ? Math.max(1, parsedSignalConcurrency)
  : 1;

// Jeda antar batch untuk menghindari beban berlebih.
const parsedSignalInterBatchDelayMs = Number.parseInt(
  process.env.SIGNAL_DETECTION_INTER_BATCH_DELAY_MS || "400",
  10,
);
const SIGNAL_DETECTION_INTER_BATCH_DELAY_MS = Number.isFinite(
  parsedSignalInterBatchDelayMs,
)
  ? Math.max(0, parsedSignalInterBatchDelayMs)
  : 400;

// Delay sederhana untuk jeda antar proses.
function sleep(ms) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Deteksi sinyal multi-indikator untuk satu simbol lalu kirim notifikasi watcher.
export async function detectAndNotifyMultiIndicatorSignals(
  symbol,
  timeframe = "1h",
) {
  try {
    console.log(`Detecting multi-indicator signals for ${symbol}...`);

    // Ambil id coin dan timeframe.
    const coin = await prisma.coin.findUnique({
      where: { symbol },
      select: { id: true },
    });

    if (!coin) {
      console.log(`${symbol}: Coin not found in database`);
      return { success: false, reason: "no_coin" };
    }

    const timeframeRecord = await prisma.timeframe.findUnique({
      where: { timeframe },
      select: { id: true },
    });

    if (!timeframeRecord) {
      console.log(`Timeframe ${timeframe} not found in database`);
      return { success: false, reason: "no_timeframe" };
    }

    const latestWeights = await prisma.indicatorWeight.findFirst({
      where: {
        coinId: coin.id,
        timeframeId: timeframeRecord.id,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!latestWeights) return { success: false, reason: "no_weights" };

    const { indicator, prevIndicator, candle } = await fetchLatestIndicatorData(
      symbol,
      timeframe,
    );
    if (!indicator || !candle) return { success: false, reason: "no_data" };

    const current = { ...indicator, close: candle.close };
    const prev = prevIndicator ? { ...prevIndicator } : null;

    // Hitung sinyal tiap indikator.
    const signals = calculateIndividualSignals(current, prev);

    // Perhitungan inti memakai calculateMultiIndicatorScore().
    // Hasil: { finalScore, strength, signal, signalLabel, normalized }
    const weightedResult = calculateMultiIndicatorScore(
      signals,
      latestWeights.weights,
    );

    const { finalScore, strength, signal, signalLabel } = weightedResult;

    // Hitung categoryScores (konsisten dengan indicator.controller.js).
    const signalToScore = (sig) => {
      if (!sig) return 0;
      const s = sig.toLowerCase();
      if (s === "buy" || s === "strong_buy") return 1;
      if (s === "sell" || s === "strong_sell") return -1;
      return 0;
    };

    const w = latestWeights.weights;
    const trendScore =
      signalToScore(signals.SMA) * (w.SMA || 0) +
      signalToScore(signals.EMA) * (w.EMA || 0) +
      signalToScore(signals.PSAR) * (w.PSAR || 0);
    const trendWeight = (w.SMA || 0) + (w.EMA || 0) + (w.PSAR || 0);

    const momentumScore =
      signalToScore(signals.RSI) * (w.RSI || 0) +
      signalToScore(signals.MACD) * (w.MACD || 0) +
      signalToScore(signals.Stochastic) * (w.Stochastic || 0) +
      signalToScore(signals.StochasticRSI) * (w.StochasticRSI || 0);
    const momentumWeight =
      (w.RSI || 0) +
      (w.MACD || 0) +
      (w.Stochastic || 0) +
      (w.StochasticRSI || 0);

    const volatilityScore =
      signalToScore(signals.BollingerBands) * (w.BollingerBands || 0);
    const volatilityWeight = w.BollingerBands || 0;

    const categoryScores = {
      trend: parseFloat(
        (trendWeight > 0 ? trendScore / trendWeight : 0).toFixed(2),
      ),
      momentum: parseFloat(
        (momentumWeight > 0 ? momentumScore / momentumWeight : 0).toFixed(2),
      ),
      volatility: parseFloat(
        (volatilityWeight > 0 ? volatilityScore / volatilityWeight : 0).toFixed(
          2,
        ),
      ),
    };

    // Log hasil untuk debugging.
    console.log(`[MultiIndicator] ${symbol} Signal:`, {
      signal: signalLabel,
      finalScore: finalScore.toFixed(3),
      strength: strength.toFixed(3),
      categoryScores,
      price: candle.close.toFixed(2),
    });

    // Strategi notifikasi: kirim semua sinyal ke pengguna watchlist.
    console.log(
      `${signal === "neutral" ? "⚪" : signal.includes("buy") ? "🟢" : "🔴"} ${symbol} ${signalLabel} | finalScore: ${finalScore.toFixed(3)}`,
    );

    // Hitung performa 1 tahun untuk konteks sinyal.
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 1);

    let performance;

    try {
      const indicators = await prisma.indicator.findMany({
        where: {
          coinId: coin.id,
          timeframeId: timeframeRecord.id,
          time: {
            gte: BigInt(startDate.getTime()),
            lte: BigInt(endDate.getTime()),
          },
        },
        orderBy: { time: "asc" },
      });

      const candles = await prisma.candle.findMany({
        where: {
          coinId: coin.id,
          timeframeId: timeframeRecord.id,
          time: {
            gte: BigInt(startDate.getTime()),
            lte: BigInt(endDate.getTime()),
          },
        },
        orderBy: { time: "asc" },
        select: { close: true },
      });

      if (indicators.length < 50 || candles.length < 50) {
        throw new Error("Not enough data");
      }

      const data = indicators
        .map((ind, i) => ({
          ...ind,
          close: candles[i]?.close,
        }))
        .filter((d) => d.close !== undefined);

      const resultBacktest = await backtestWithWeights(
        data,
        latestWeights.weights,
      );

      performance = {
        roi: resultBacktest.roi,
        winRate: resultBacktest.winRate,
        maxDrawdown: resultBacktest.maxDrawdown,
        sharpeRatio: resultBacktest.sharpeRatio || 0,
        trades: resultBacktest.trades,
      };
    } catch (err) {
      console.log("fallback ke data lama");

      performance = {
        roi: latestWeights.testROI || latestWeights.roi,
        winRate: latestWeights.testWinRate || latestWeights.winRate,
        maxDrawdown: latestWeights.testMaxDrawdown || latestWeights.maxDrawdown,
        sharpeRatio: latestWeights.testSharpe || latestWeights.sharpeRatio || 0,
        trades: latestWeights.testTrades || latestWeights.trades,
      };
    }

    // Kirim notifikasi Telegram hanya ke watcher coin ini.
    const result = await sendSignalToWatchers({
      coinId: coin.id,
      symbol,
      signal,
      signalLabel, // Label untuk tampilan (STRONG BUY, BUY, dll)
      price: candle.close,
      strength,
      finalScore, // FinalScore ternormalisasi [-1, +1]
      categoryScores, // Untuk interpretasi market
      activeIndicators: Object.entries(latestWeights.weights).map(([k, w]) => ({
        name: k,
        weight: w,
      })),
      performance,
      timeframe,
    });

    if (result.success) {
      console.log(
        `${symbol} ${signalLabel} | finalScore: ${finalScore.toFixed(3)} | strength: ${strength.toFixed(3)} | notified: ${result.sent}/${result.eligible ?? result.total} watchers`,
      );
    }

    return {
      success: true,
      signal,
      signalLabel,
      finalScore,
      strength,
      categoryScores,
    };
  } catch (err) {
    console.error(
      `Error detecting multi-indicator signals for ${symbol}:`,
      err.message,
    );
    return { success: false, error: err.message };
  }
}

// Jalankan deteksi sinyal multi-indikator untuk banyak simbol secara berurutan.
export async function detectAndNotifyAllSymbols(symbols, mode = "multi") {
  // Pastikan mode selalu "multi".
  mode = "multi";

  const startedAt = Date.now();

  console.log(
    `Detecting multi-indicator signals for ${symbols.length} symbols... (concurrency=${SIGNAL_DETECTION_CONCURRENCY}, interBatchDelay=${SIGNAL_DETECTION_INTER_BATCH_DELAY_MS}ms)`,
  );

  const results = {
    multi: { success: 0, failed: 0, neutral: 0, noWeights: 0 },
  };

  const applyResult = (r) => {
    if (r?.reason === "no_weights") results.multi.noWeights++;
    else if (r?.signal === "neutral") results.multi.neutral++;
    else if (r?.success) results.multi.success++;
    else results.multi.failed++;
  };

  if (SIGNAL_DETECTION_CONCURRENCY <= 1) {
    for (const symbol of symbols) {
      const symbolStart = Date.now();
      try {
        const r = await detectAndNotifyMultiIndicatorSignals(symbol);
        applyResult(r);
      } catch (err) {
        console.error(`❌ Error processing ${symbol}:`, err.message);
        results.multi.failed++;
      } finally {
        console.log(
          `[${new Date().toISOString()}] Signal detection finished for ${symbol} in ${Date.now() - symbolStart}ms`,
        );
      }

      await sleep(SIGNAL_DETECTION_INTER_BATCH_DELAY_MS);
    }
  } else {
    for (let i = 0; i < symbols.length; i += SIGNAL_DETECTION_CONCURRENCY) {
      const batch = symbols.slice(i, i + SIGNAL_DETECTION_CONCURRENCY);
      const batchStart = Date.now();

      const batchResults = await Promise.all(
        batch.map(async (symbol) => {
          const symbolStart = Date.now();
          try {
            const result = await detectAndNotifyMultiIndicatorSignals(symbol);
            return { symbol, result };
          } catch (err) {
            return { symbol, error: err };
          } finally {
            console.log(
              `⏱️ [${new Date().toISOString()}] Signal detection finished for ${symbol} in ${Date.now() - symbolStart}ms`,
            );
          }
        }),
      );

      for (const item of batchResults) {
        if (item.error) {
          console.error(`Error processing ${item.symbol}:`, item.error.message);
          results.multi.failed++;
          continue;
        }
        applyResult(item.result);
      }

      console.log(
        `[${new Date().toISOString()}] Signal detection batch ${Math.floor(i / SIGNAL_DETECTION_CONCURRENCY) + 1} finished in ${Date.now() - batchStart}ms`,
      );

      if (i + SIGNAL_DETECTION_CONCURRENCY < symbols.length) {
        await sleep(SIGNAL_DETECTION_INTER_BATCH_DELAY_MS);
      }
    }
  }

  console.log("Detection Summary:", results);
  console.log(
    `[${new Date().toISOString()}] Detection total duration: ${Date.now() - startedAt}ms`,
  );
  return results;
}

// Cek aset yang belum punya bobot optimasi dan tandai untuk diproses.
export async function autoOptimizeCoinsWithoutWeights(
  symbols,
  timeframe = "1h",
) {
  // Ambil timeframe id sekali saja.
  const timeframeRecord = await prisma.timeframe.findUnique({
    where: { timeframe },
    select: { id: true },
  });

  if (!timeframeRecord) {
    console.error(`Timeframe ${timeframe} not found in database`);
    return { count: 0, needs: [] };
  }

  const needs = [];
  for (const symbol of symbols) {
    // Ambil id coin.
    const coin = await prisma.coin.findUnique({
      where: { symbol },
      select: { id: true },
    });

    if (!coin) {
      console.log(`${symbol}: Coin not found in database, skipping...`);
      continue;
    }

    const existing = await prisma.indicatorWeight.findFirst({
      where: {
        coinId: coin.id,
        timeframeId: timeframeRecord.id,
      },
    });

    if (!existing) {
      const count = await prisma.candle.count({
        where: {
          coinId: coin.id,
          timeframeId: timeframeRecord.id,
        },
      });
      if (count >= 1000) needs.push(symbol);
      else console.log(`${symbol}: Only ${count}/1000 candles`);
    }
  }

  if (!needs.length) return console.log("All coins optimized.");

  console.log(`Coins needing optimization: ${needs.join(", ")}`);
  return { count: needs.length, needs };
}

export default {
  detectAndNotifyMultiIndicatorSignals,
  detectAndNotifyAllSymbols,
  autoOptimizeCoinsWithoutWeights,
};
