// File formatter indikator.
// Tujuan: memisahkan pembentukan response API agar service utama fokus ke alur data.

/**
 * Format indicators structure from database record
 */
export function formatIndicatorStructure(indicator) {
  return {
    sma: {
      20: indicator.sma20 ?? null,
      50: indicator.sma50 ?? null,
      signal: indicator.smaSignal || "neutral",
    },
    ema: {
      20: indicator.ema20 ?? null,
      50: indicator.ema50 ?? null,
      signal: indicator.emaSignal || "neutral",
    },
    rsi: {
      14: indicator.rsi ?? null,
      signal: indicator.rsiSignal || "neutral",
    },
    macd: {
      macd: indicator.macd ?? null,
      signalLine: indicator.macdSignalLine ?? null,
      histogram: indicator.macdHist ?? null,
      signal: indicator.macdSignal || "neutral",
    },
    bollingerBands: {
      upper: indicator.bbUpper ?? null,
      middle: indicator.bbMiddle ?? null,
      lower: indicator.bbLower ?? null,
      signal: indicator.bbSignal || "neutral",
    },
    stochastic: {
      "%K": indicator.stochK ?? null,
      "%D": indicator.stochD ?? null,
      signal: indicator.stochSignal || "neutral",
    },
    stochasticRsi: {
      "%K": indicator.stochRsiK ?? null,
      "%D": indicator.stochRsiD ?? null,
      signal: indicator.stochRsiSignal || "neutral",
    },
    parabolicSar: {
      value: indicator.psar ?? null,
      signal: indicator.psarSignal || "neutral",
    },
  };
}

/**
 * Format performance data from weight record
 */
export function formatPerformanceData(weightRecord) {
  if (!weightRecord) return null;

  return {
    roi: weightRecord.roi,
    winRate: weightRecord.winRate,
    maxDrawdown: weightRecord.maxDrawdown,
    sharpeRatio: weightRecord.sharpeRatio,
    trades: weightRecord.trades,
    finalCapital: weightRecord.finalCapital,
    trainingPeriod: {
      startDate: Number(weightRecord.startTest),
      endDate: Number(weightRecord.endTest),
      startDateReadable: formatReadableDate(Number(weightRecord.startTest)),
      endDateReadable: formatReadableDate(Number(weightRecord.endTest)),
    },
  };
}

/**
 * Helper: Format readable date
 */
export function formatReadableDate(date) {
  if (!date) return null;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(date));
}

/**
 * Organize indicator data with prices
 */
export function organizeIndicatorData(indicators, priceMap) {
  return indicators.map((d) => {
    const bbMiddle =
      d.bbMiddle ??
      (d.bbUpper && d.bbLower
        ? (d.bbUpper + d.bbLower) / 2
        : (d.sma20 ?? null));

    return {
      time: Number(d.time),
      price: priceMap.get(Number(d.time)) ?? null,
      indicators: {
        sma: {
          20: d.sma20 ?? null,
          50: d.sma50 ?? null,
          signal: d.smaSignal ?? "neutral",
        },
        ema: {
          20: d.ema20 ?? null,
          50: d.ema50 ?? null,
          signal: d.emaSignal ?? "neutral",
        },
        rsi: {
          14: d.rsi ?? null,
          signal: d.rsiSignal ?? "neutral",
        },
        macd: {
          macd: d.macd ?? null,
          signalLine: d.macdSignalLine ?? null,
          histogram: d.macdHist ?? null,
          signal: d.macdSignal ?? "neutral",
        },
        bollingerBands: {
          upper: d.bbUpper ?? null,
          middle: bbMiddle,
          lower: d.bbLower ?? null,
          signal: d.bbSignal ?? "neutral",
        },
        stochastic: {
          "%K": d.stochK ?? null,
          "%D": d.stochD ?? null,
          signal: d.stochSignal ?? "neutral",
        },
        stochasticRsi: {
          "%K": d.stochRsiK ?? null,
          "%D": d.stochRsiD ?? null,
          signal: d.stochRsiSignal ?? "neutral",
        },
        parabolicSar: {
          value: d.psar ?? null,
          signal: d.psarSignal ?? "neutral",
        },
      },
      overallSignal: d.overallSignal ?? "neutral",
      signalStrength: d.signalStrength ?? 0.5,
    };
  });
}

/**
 * Build pagination metadata
 */
export function buildIndicatorPagination(
  req,
  page,
  totalPages,
  limit,
  showAll,
) {
  if (showAll) return null;

  const hasNext = page < totalPages;
  const hasPrev = page > 1;
  const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

  return {
    next: hasNext
      ? { page: page + 1, url: `${baseUrl}?page=${page + 1}` }
      : null,
    prev: hasPrev
      ? { page: page - 1, url: `${baseUrl}?page=${page - 1}` }
      : null,
  };
}

/**
 * Build latest signal object
 */
export function buildLatestSignal(
  latestIndicator,
  latestWeight,
  priceMap,
  formatMultiSignalFromDB,
  formatIndicatorStructureFn,
) {
  if (!latestIndicator) return null;

  const latestPrice = priceMap.get(Number(latestIndicator.time)) ?? null;
  const multiSignal = formatMultiSignalFromDB(
    latestIndicator,
    latestWeight?.weights,
  );
  const indicators = formatIndicatorStructureFn(latestIndicator);

  return {
    time: Number(latestIndicator.time),
    price: latestPrice,
    multiSignal,
    weights: latestWeight?.weights ?? null,
    performance: latestWeight
      ? {
          roi: latestWeight.roi,
          winRate: latestWeight.winRate,
          maxDrawdown: latestWeight.maxDrawdown,
          sharpeRatio: latestWeight.sharpeRatio,
        }
      : null,
    indicators,
  };
}

/**
 * Build metadata for paginated response
 */
export function buildResponseMetadata(organized, totalIndicators, showAll) {
  const formatDate = (time) => {
    if (!time) return null;
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    }).format(new Date(time));
  };

  const rangeStart = formatDate(Number(organized[organized.length - 1]?.time));
  const rangeEnd = formatDate(Number(organized[0]?.time));
  const coveragePercent = ((organized.length / totalIndicators) * 100).toFixed(
    1,
  );

  return {
    coverage: `${organized.length}/${totalIndicators}`,
    coveragePercent: showAll ? "100%" : `${coveragePercent}%`,
    range: { start: rangeStart, end: rangeEnd },
    source: "database",
  };
}
