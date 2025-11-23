import { prisma } from "../lib/prisma.js";
import { getChartDataNewest } from "../services/charts/chartdata.service.js";
import { getCoinLiveDetail } from "../services/market/index.js";
import { calculateAndSaveIndicators } from "../services/indicators/indicator.service.js";

/**
 * Helper: Normalize overallSignal dari database ke format chart
 * @param {string} overallSignal - "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell"
 * @param {number} signalStrength - 0.0 to 1.0
 * @param {object} indicator - Full indicator object for recalculation if needed
 * @param {object} weights - Optional weights for recalculation
 * @returns {object|null} multiSignal object atau null jika tidak ada signal
 *
 * ✅ KONSISTENSI RULE:
 * - Jika signal = "neutral" → strength HARUS = 0, normalized HARUS = 0
 * - Jika signal = "buy"/"sell" → strength = Math.abs(signalStrength), normalized dari weighted calc
 */
function normalizeSignal(
  overallSignal,
  signalStrength = 0,
  indicator = null,
  weights = null
) {
  if (!overallSignal) {
    console.warn("⚠️ [normalizeSignal] overallSignal is null/undefined");
    return null;
  }

  const signal = overallSignal.toLowerCase().trim();

  // Mapping sesuai requirement:
  // strong_buy → "buy"
  // buy → "buy"
  // strong_sell → "sell"
  // sell → "sell"
  // neutral → "neutral"

  let normalizedSignal = "neutral"; // default
  let normalizedStrength = 0;
  let normalizedScore = 0; // ✅ NEW: normalized score

  if (signal === "strong_buy" || signal === "buy") {
    normalizedSignal = "buy";
    normalizedStrength = Math.abs(signalStrength || 0);
  } else if (signal === "strong_sell" || signal === "sell") {
    normalizedSignal = "sell";
    normalizedStrength = Math.abs(signalStrength || 0);
  } else if (signal === "neutral") {
    normalizedSignal = "neutral";
    normalizedStrength = 0; // ✅ FORCE: neutral HARUS strength = 0
    normalizedScore = 0; // ✅ FORCE: neutral HARUS normalized = 0

    // ⚠️ Warning jika DB kirim neutral tapi strength > 0
    if (signalStrength > 0) {
      console.warn(
        `⚠️ [normalizeSignal] MISMATCH DETECTED: neutral with strength ${signalStrength} → forced to 0`
      );
    }
  } else {
    console.warn(`⚠️ [normalizeSignal] Unknown signal: ${signal}`);
    normalizedSignal = "neutral";
    normalizedStrength = 0;
    normalizedScore = 0;
  }

  // ✅ Hitung normalized score jika ada weights dan bukan neutral
  if (normalizedSignal !== "neutral" && indicator && weights) {
    try {
      // Import calculateWeightedSignal untuk recalculation
      const {
        calculateIndividualSignals,
        calculateWeightedSignal,
      } = require("../utils/indicator.utils.js");

      const signals = calculateIndividualSignals(indicator);
      const weighted = calculateWeightedSignal(signals, weights.weights);

      normalizedScore = weighted.normalized;

      console.log(`🔍 [normalizeSignal] Recalculated normalized:`, {
        signal: normalizedSignal,
        strength: normalizedStrength.toFixed(3),
        normalized: normalizedScore.toFixed(3),
      });
    } catch (err) {
      console.warn(
        `⚠️ [normalizeSignal] Failed to recalculate normalized: ${err.message}`
      );
      // Fallback: estimate dari strength
      normalizedScore =
        normalizedSignal === "buy"
          ? normalizedStrength
          : normalizedSignal === "sell"
            ? -normalizedStrength
            : 0;
    }
  } else if (normalizedSignal !== "neutral") {
    // Fallback: estimate normalized dari strength
    // Buy → positive, Sell → negative
    normalizedScore =
      normalizedSignal === "buy" ? normalizedStrength : -normalizedStrength;
  }

  // ✅ FINAL VALIDATION: Double-check konsistensi
  if (
    normalizedSignal === "neutral" &&
    (normalizedStrength !== 0 || normalizedScore !== 0)
  ) {
    console.error(
      `❌ [normalizeSignal] CRITICAL: neutral escaped with strength ${normalizedStrength} or normalized ${normalizedScore}! Forcing to 0.`
    );
    normalizedStrength = 0;
    normalizedScore = 0;
  }

  return {
    signal: normalizedSignal,
    source: "db",
    strength: normalizedStrength,
    normalized: normalizedScore, // ✅ NEW: tambahkan normalized score
    rawSignal: overallSignal, // ✅ Keep raw untuk debugging
  };
}

export async function getChart(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = req.query.timeframe || "1h";
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(5000, parseInt(req.query.limit) || 1000);
    const offset = (page - 1) * limit;

    console.log(`📊 [Chart] ${symbol} | Page ${page} | Limit ${limit}`);

    // ✅ Ambil info coin (name + logo) dari tabel Coin
    const coinInfo = await prisma.coin.findUnique({
      where: { symbol },
      select: {
        name: true,
        logo: true,
      },
    });

    console.log(`🔍 [Chart] Coin info:`, {
      symbol,
      name: coinInfo?.name || null,
      logo: coinInfo?.logo || null,
    });

    // Ambil candle dari service
    const chartData = await getChartDataNewest(symbol, limit, offset);
    if (!chartData.candles.length) {
      return res.json({
        success: true,
        symbol,
        name: coinInfo?.name || null, // ✅ Include name
        logo: coinInfo?.logo || null, // ✅ Include logo
        timeframe,
        total: 0,
        page,
        totalPages: 0,
        limit,
        pagination: { next: null, prev: null },
        liveData: null,
        data: [],
      });
    }

    // Hitung waktu minimum dan maksimum
    const times = chartData.candles.map((c) => Number(c.time));
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    // ✅ Ambil weights untuk recalculation normalized (opsional)
    const weights = await prisma.indicatorWeight.findFirst({
      where: { symbol, timeframe },
      orderBy: { updatedAt: "desc" },
    });

    if (weights) {
      console.log(
        `🎯 [Chart] Found optimized weights for ${symbol}, will use for normalized calculation`
      );
    }

    // Cek apakah indikator sudah lengkap untuk rentang waktu ini
    let indicators = await prisma.indicator.findMany({
      where: {
        symbol,
        timeframe,
        time: { gte: BigInt(minTime), lte: BigInt(maxTime) },
      },
      orderBy: { time: "asc" },
    });

    const coverageBefore = indicators.length;
    const expected = chartData.candles.length;
    const coveragePercentBefore = ((coverageBefore / expected) * 100).toFixed(
      1
    );

    if (coverageBefore < expected) {
      console.log(
        `⚙️ [AUTO] Indicator coverage ${coverageBefore}/${expected} (${coveragePercentBefore}%) → recalculating...`
      );
      try {
        await calculateAndSaveIndicators(symbol, timeframe, minTime, maxTime);
        console.log(
          `✅ [AUTO] Recalculated indicators for ${symbol} (${timeframe})`
        );
        indicators = await prisma.indicator.findMany({
          where: {
            symbol,
            timeframe,
            time: { gte: BigInt(minTime), lte: BigInt(maxTime) },
          },
          orderBy: { time: "asc" },
        });
        console.log(
          `📈 [AUTO] Found ${indicators.length}/${expected} indicators after recalc.`
        );
      } catch (err) {
        console.error(`❌ [AUTO] Indicator calculation failed:`, err.message);
      }
    }

    // Gabungkan candle + indikator
    const indicatorMap = new Map(indicators.map((i) => [Number(i.time), i]));
    const merged = chartData.candles.map((c) => {
      const ind = indicatorMap.get(Number(c.time));

      // ✅ Ambil multiSignal dari database menggunakan helper (dengan weights untuk recalculation)
      const multiSignal = ind
        ? normalizeSignal(ind.overallSignal, ind.signalStrength, ind, weights)
        : null;

      // ✅ Log debug untuk tracking
      if (
        multiSignal &&
        (multiSignal.signal === "buy" || multiSignal.signal === "sell")
      ) {
        console.log(`[Chart] Signal mapping:`, {
          time: new Date(Number(c.time)).toISOString(),
          signal: multiSignal.signal,
          strength: multiSignal.strength.toFixed(3),
          normalized: multiSignal.normalized.toFixed(3),
        });
      }

      return {
        time: c.time.toString(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        multiSignal: multiSignal, // ✅ Dari DB dengan normalized score
        indicators: ind
          ? {
              sma: { 20: ind.sma20, 50: ind.sma50 },
              ema: { 20: ind.ema20, 50: ind.ema50 },
              rsi: { 14: ind.rsi },
              macd: {
                macd: ind.macd,
                signalLine: ind.macdSignal,
                histogram: ind.macdHist,
              },
              bollingerBands: {
                upper: ind.bbUpper,
                middle: ind.bbMiddle,
                lower: ind.bbLower,
              },
              stochastic: {
                "%K": ind.stochK,
                "%D": ind.stochD,
              },
              stochasticRsi: {
                "%K": ind.stochRsiK,
                "%D": ind.stochRsiD,
              },
              parabolicSar: {
                value: ind.psar,
              },
            }
          : null,
      };
    });

    // Hitung coverage setelah merge
    const withIndicators = merged.filter((m) => m.indicators).length;
    const coverage = (withIndicators / merged.length) * 100;

    // 📊 Log multiSignal stats untuk debugging
    const signalStats = {
      buy: merged.filter((m) => m.multiSignal?.signal === "buy").length,
      sell: merged.filter((m) => m.multiSignal?.signal === "sell").length,
      neutral: merged.filter((m) => m.multiSignal?.signal === "neutral").length,
      missing: merged.filter((m) => !m.multiSignal).length,
    };
    console.log(
      `📍 [Signal] BUY: ${signalStats.buy} | SELL: ${signalStats.sell} | NEUTRAL: ${signalStats.neutral} | MISSING: ${signalStats.missing}`
    );

    // Pagination setup
    const totalPages = Math.ceil(chartData.total / limit);
    const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;
    const next =
      page < totalPages
        ? {
            page: page + 1,
            url: `${baseUrl}?page=${page + 1}&limit=${limit}&timeframe=${timeframe}`,
          }
        : null;
    const prev =
      page > 1
        ? {
            page: page - 1,
            url: `${baseUrl}?page=${page - 1}&limit=${limit}&timeframe=${timeframe}`,
          }
        : null;

    const live = await getCoinLiveDetail(symbol);

    // Kirim response
    return res.json({
      success: true,
      symbol,
      name: coinInfo?.name || null, // ✅ Include name
      logo: coinInfo?.logo || null, // ✅ Include logo
      timeframe,
      total: chartData.total,
      page,
      totalPages,
      limit,
      pagination: { next, prev },
      metadata: {
        coverage: `${withIndicators}/${merged.length}`,
        coveragePercent: `${coverage.toFixed(1)}%`,
        signalDistribution: signalStats, // ✅ Tambahkan stats untuk debugging
        range: {
          start: new Date(minTime).toLocaleString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          end: new Date(maxTime).toLocaleString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      },
      liveData: live?.data || null,
      data: merged,
    });
  } catch (err) {
    console.error("❌ Chart Error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}
