import { calculateOverallSignal } from "../signals/overallAnalyzer.js";
import {
  findCoinIdBySymbol,
  findLatestWeightRecord,
  findTimeframeByValue,
} from "./indicator.repository.js";

// File cache bobot indikator.
// Tujuan: mengurangi query berulang ke database saat menghitung overall signal.

const weightsCache = new Map();

function getWeightsCacheKey(symbol, timeframe) {
  return `${symbol}::${timeframe}`;
}

// Hapus cache bobot per simbol-timeframe agar memakai hasil optimasi terbaru.
export function invalidateWeightsCache(symbol, timeframe = "1h") {
  if (!symbol) return;
  weightsCache.delete(getWeightsCacheKey(symbol, timeframe));
}

// Hapus seluruh cache bobot (opsional untuk maintenance/debugging).
export function clearWeightsCache() {
  weightsCache.clear();
}

export async function calculateOverallSignalOptimized(
  signals,
  symbol,
  timeframe,
) {
  const cacheKey = getWeightsCacheKey(symbol, timeframe);

  // Check cache first
  let weights = weightsCache.get(cacheKey);

  if (!weights) {
    // Get coinId and timeframeId for query
    const coin = await findCoinIdBySymbol(symbol);
    const timeframeRecord = await findTimeframeByValue(timeframe);

    // Load weights from database (from indicatorWeight table)
    if (coin && timeframeRecord) {
      const weightRecord = await findLatestWeightRecord(
        coin.id,
        timeframeRecord.id,
        { weights: true },
      );

      // Use weights or fallback to equal weights
      if (weightRecord?.weights) {
        weights = weightRecord.weights;
      }
    }

    // Fallback to equal weights if no record found
    if (!weights) {
      weights = {
        SMA: 1,
        EMA: 1,
        RSI: 1,
        MACD: 1,
        BollingerBands: 1,
        Stochastic: 1,
        StochasticRSI: 1,
        PSAR: 1,
      };
    }

    weightsCache.set(cacheKey, weights);
  }

  // Use cached weights to avoid DB query for every indicator
  return calculateOverallSignal(signals, symbol, timeframe, weights);
}
