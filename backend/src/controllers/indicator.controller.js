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

// Format data multi-signal dari database untuk kebutuhan response API.
function formatMultiSignalFromDB(ind, weights = null) {
  if (!ind) return null;

  // Ambil nilai final langsung dari database tanpa hitung ulang.
  const finalScore = ind.finalScore ?? 0;
  const strength = ind.signalStrength ?? 0;

  // Kelaskan sinyal berdasarkan threshold skor akhir.
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
    // Kondisi ini berlaku saat finalScore = 0.
    signal = "neutral";
    signalLabel = "NEUTRAL";
    signalEmoji = "⚪";
  }

  // Hitung kontribusi kategori jika bobot tersedia.
  let categoryScores = { trend: 0, momentum: 0, volatility: 0 };

  if (weights) {
    const signalToScore = (sig) => {
      if (!sig) return 0;
      const normalized = sig.toLowerCase();
      if (normalized === "buy" || normalized === "strong_buy") return 1;
      if (normalized === "sell" || normalized === "strong_sell") return -1;
      return 0;
    };

    // Kategori trend: SMA + EMA + PSAR.
    const trendScore =
      signalToScore(ind.smaSignal) * (weights.SMA || 0) +
      signalToScore(ind.emaSignal) * (weights.EMA || 0) +
      signalToScore(ind.psarSignal) * (weights.PSAR || 0);

    // Kategori momentum: RSI + MACD + Stochastic + StochasticRSI.
    const momentumScore =
      signalToScore(ind.rsiSignal) * (weights.RSI || 0) +
      signalToScore(ind.macdSignal) * (weights.MACD || 0) +
      signalToScore(ind.stochSignal) * (weights.Stochastic || 0) +
      signalToScore(ind.stochRsiSignal) * (weights.StochasticRSI || 0);

    // Kategori volatility: Bollinger Bands.
    const volatilityScore =
      signalToScore(ind.bbSignal) * (weights.BollingerBands || 0);

    categoryScores = {
      trend: parseFloat(trendScore.toFixed(2)),
      momentum: parseFloat(momentumScore.toFixed(2)),
      volatility: parseFloat(volatilityScore.toFixed(2)),
    };
  }

  return {
    signal,
    strength: parseFloat(strength.toFixed(3)),
    finalScore: parseFloat(finalScore.toFixed(3)),
    signalLabel,
    signalEmoji,
    categoryScores,
    source: "db",
  };
}

// Ambil data sinyal indikator dengan mode latest atau paginated.
export async function getSignals(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = req.query.timeframe || "1h";
    const mode = req.query.mode || "paginated";

    console.log(`Fetching indicators for ${symbol} (mode: ${mode})`);
    const startTime = Date.now();

    // Ambil coinId dan timeframeId untuk query database.
    const { coinId, timeframeId } = await getCoinAndTimeframeIds(
      symbol,
      timeframe,
    );

    // Mode latest: kirim hanya sinyal terbaru.
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

    // Mode paginated: kirim data per halaman.
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

    // Ambil data utama dalam satu pemanggilan service.
    const {
      indicators: data,
      prices: candlePrices,
      latestIndicator,
      latestWeight,
    } = await getPaginatedSignalData(coinId, timeframeId, page, limit, showAll);

    // Susun data indikator agar siap dipakai frontend.
    const priceMap = new Map(
      candlePrices.map((c) => [Number(c.time), c.close]),
    );
    const organized = organizeIndicatorData(data, priceMap);

    // Bentuk sinyal terbaru untuk panel ringkasan.
    const latestSignal = buildLatestSignal(
      latestIndicator,
      latestWeight,
      priceMap,
      formatMultiSignalFromDB,
      formatIndicatorStructure,
    );

    // Bentuk metadata dan pagination response.
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
