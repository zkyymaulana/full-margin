import { prisma } from "../lib/prisma.js";
import {
  getCoinAndTimeframeIds,
  getLatestSignalData,
  formatIndicatorStructure,
  formatPerformanceData,
  organizeIndicatorData,
  buildIndicatorPagination,
  getPaginatedSignalData,
  buildLatestSignal,
  buildResponseMetadata,
} from "../services/indicators/indicator.service.js";

/**
 * 🎯 FORMAT MULTI-SIGNAL FROM DATABASE (REFACTORED)
 * ================================================================
 * SESUAI PROPOSAL SKRIPSI - Menggunakan Single Source of Truth
 *
 * PENTING:
 * - FinalScore dan signalStrength SUDAH tersimpan di database
 * - Fungsi ini hanya mem-FORMAT untuk display/UI
 * - TIDAK melakukan perhitungan ulang (konsistensi data)
 * - Menggunakan multi-level threshold untuk label
 *
 * Signal Classification:
 * - finalScore >= 0.6  → STRONG BUY 🟢🟢
 * - finalScore > 0     → BUY 🟢
 * - finalScore == 0    → NEUTRAL ⚪
 * - finalScore < 0     → SELL 🔴
 * - finalScore <= -0.6 → STRONG SELL 🔴🔴
 * ================================================================
 */
function formatMultiSignalFromDB(ind, weights = null) {
  if (!ind) return null;

  // ✅ Ambil langsung dari database (NO RECALCULATION)
  const finalScore = ind.finalScore ?? 0;
  const strength = ind.signalStrength ?? 0;

  // 🎯 SIGNAL CLASSIFICATION (MULTI-LEVEL THRESHOLD)
  // Threshold yang sama dengan calculateMultiIndicatorScore()
  let signal = "neutral";
  let signalLabel = "NEUTRAL";
  let signalEmoji = "⚪";

  const STRONG_BUY_THRESHOLD = 0.6;
  const STRONG_SELL_THRESHOLD = -0.6;

  if (finalScore >= STRONG_BUY_THRESHOLD) {
    signal = "strong_buy";
    signalLabel = "STRONG BUY";
    signalEmoji = "🟢🟢";
  } else if (finalScore > 0) {
    signal = "buy";
    signalLabel = "BUY";
    signalEmoji = "🟢";
  } else if (finalScore <= STRONG_SELL_THRESHOLD) {
    signal = "strong_sell";
    signalLabel = "STRONG SELL";
    signalEmoji = "🔴🔴";
  } else if (finalScore < 0) {
    signal = "sell";
    signalLabel = "SELL";
    signalEmoji = "🔴";
  } else {
    // finalScore === 0
    signal = "neutral";
    signalLabel = "NEUTRAL";
    signalEmoji = "⚪";
  }

  // 🎯 CALCULATE WEIGHTED CATEGORY SCORES
  // Kontribusi masing-masing kategori terhadap finalScore
  let categoryScores = { trend: 0, momentum: 0, volatility: 0 };

  if (weights) {
    const signalToScore = (sig) => {
      if (!sig) return 0;
      const normalized = sig.toLowerCase();
      if (normalized === "buy" || normalized === "strong_buy") return 1;
      if (normalized === "sell" || normalized === "strong_sell") return -1;
      return 0;
    };

    // WEIGHTED Trend category (SMA + EMA + PSAR)
    const trendScore =
      signalToScore(ind.smaSignal) * (weights.SMA || 0) +
      signalToScore(ind.emaSignal) * (weights.EMA || 0) +
      signalToScore(ind.psarSignal) * (weights.PSAR || 0);

    // WEIGHTED Momentum category (RSI + MACD + Stochastic + StochasticRSI)
    const momentumScore =
      signalToScore(ind.rsiSignal) * (weights.RSI || 0) +
      signalToScore(ind.macdSignal) * (weights.MACD || 0) +
      signalToScore(ind.stochSignal) * (weights.Stochastic || 0) +
      signalToScore(ind.stochRsiSignal) * (weights.StochasticRSI || 0);

    // WEIGHTED Volatility category (BollingerBands)
    const volatilityScore =
      signalToScore(ind.bbSignal) * (weights.BollingerBands || 0);

    categoryScores = {
      trend: parseFloat(trendScore.toFixed(2)),
      momentum: parseFloat(momentumScore.toFixed(2)),
      volatility: parseFloat(volatilityScore.toFixed(2)),
    };
  }

  return {
    signal, // 'buy'/'sell'/'neutral'/'strong_buy'/'strong_sell'
    strength: parseFloat(strength.toFixed(3)), // Confidence level [0, 1]
    finalScore: parseFloat(finalScore.toFixed(3)), // Normalized score [-1, +1]
    signalLabel, // 'BUY'/'SELL'/'STRONG BUY'/etc
    signalEmoji, // Visual indicator
    categoryScores, // Breakdown per kategori
    source: "db", // Data source indicator
  };
}

/* ===========================================================
  GET INDICATORS API — Support mode=latest & mode=paginated
=========================================================== */
export async function getSignals(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = req.query.timeframe || "1h";
    const mode = req.query.mode || "paginated";

    console.log(`Fetching indicators for ${symbol} (mode: ${mode})`);
    const startTime = Date.now();

    // Get coinId and timeframeId
    const { coinId, timeframeId } = await getCoinAndTimeframeIds(
      symbol,
      timeframe,
    );

    // LATEST MODE - Return only latest signal
    if (mode === "latest") {
      const { indicator, weight, price } = await getLatestSignalData(
        coinId,
        timeframeId,
      );

      const multiSignal = formatMultiSignalFromDB(indicator, weight?.weights);
      const indicators = formatIndicatorStructure(indicator);
      const performance = formatPerformanceData(weight);
      const processingTime = Date.now() - startTime;

      return res.json({
        success: true,
        symbol,
        timeframe,
        mode: "latest",
        processingTime: `${processingTime}ms`,
        latestSignal: {
          time: Number(indicator.time),
          price,
          multiSignal: multiSignal || {
            signal: "neutral",
            strength: 0,
            finalScore: 0,
            signalLabel: "NEUTRAL",
            signalEmoji: "⚪",
            source: "db",
          },
          weights: weight?.weights ?? null,
          performance,
          indicators,
        },
      });
    }

    // PAGINATED MODE - Return paginated data
    const requestedShowAll = req.query.all === "true";
    const allowAllMode = process.env.ALLOW_INDICATOR_ALL_MODE === "true";
    const showAll = requestedShowAll && allowAllMode;
    const limit = Math.min(
      1000,
      Math.max(100, parseInt(req.query.limit) || 500),
    );
    const page = Math.max(1, parseInt(req.query.page) || 1);

    if (requestedShowAll && !allowAllMode) {
      console.warn(
        `⏭️ showAll request ignored for ${symbol} (ALLOW_INDICATOR_ALL_MODE=false)`,
      );
    }

    const totalIndicators = await prisma.indicator.count({
      where: { coinId, timeframeId },
    });

    if (totalIndicators === 0) {
      return res.status(404).json({
        success: false,
        message: `Tidak ada data indikator untuk ${symbol}.`,
      });
    }

    // Fetch all data in parallel (single service call)
    const {
      indicators: data,
      prices: candlePrices,
      latestIndicator,
      latestWeight,
    } = await getPaginatedSignalData(coinId, timeframeId, page, limit, showAll);

    // Organize data
    const priceMap = new Map(
      candlePrices.map((c) => [Number(c.time), c.close]),
    );
    const organized = organizeIndicatorData(data, priceMap);

    // Build latest signal (using service function)
    const latestSignal = buildLatestSignal(
      latestIndicator,
      latestWeight,
      priceMap,
      formatMultiSignalFromDB,
      formatIndicatorStructure,
    );

    // Build response
    const processingTime = Date.now() - startTime;
    const totalPages = showAll ? 1 : Math.ceil(totalIndicators / limit);
    const metadata = buildResponseMetadata(organized, totalIndicators, showAll);
    const pagination = buildIndicatorPagination(
      req,
      page,
      totalPages,
      limit,
      showAll,
    );

    res.json({
      success: true,
      symbol,
      timeframe,
      totalData: organized.length,
      totalIndicators,
      processingTime: `${processingTime}ms`,
      ...(showAll
        ? { mode: "all" }
        : { mode: "paginated", totalPages, page, limit, pagination }),
      metadata,
      latestSignal,
      data: organized,
    });
  } catch (err) {
    console.error("getSignals error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
}
