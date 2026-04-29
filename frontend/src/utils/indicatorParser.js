// Format angka umum dengan jumlah desimal tertentu.
export const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num)) return null;
  return Number(num).toFixed(decimals);
};

// Format harga dengan pemisah ribuan agar lebih mudah dibaca.
export const formatPrice = (price) => {
  if (price === null || price === undefined || isNaN(price)) return null;
  return Number(price).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Format nilai persentase (ROI, win rate, max drawdown) dengan suffix %.
export const formatPercent = (num) => {
  if (num === null || num === undefined || isNaN(num)) return "N/A";
  return `${Number(num).toFixed(2)}%`;
};

// Format nilai rasio (Sharpe, Sortino) tanpa suffix persen.
export const formatRatio = (num) => {
  if (num === null || num === undefined || isNaN(num)) return "N/A";
  return Number(num).toFixed(2);
};

// Format ROI dari backend dengan 2 desimal.
export const formatROI = (num) => {
  if (!num && num !== 0) return "N/A";
  return Number(num).toFixed(2);
};

// Bentuk label sinyal + kelas warna + jenis ikon berdasarkan nilai sinyal.
export const getIndicatorSignal = (signal, isDarkMode) => {
  const normalizedSignal = signal?.toLowerCase();

  if (normalizedSignal === "buy") {
    return {
      signal: "BUY",
      color: isDarkMode
        ? "bg-green-900 text-green-300"
        : "bg-green-100 text-green-700",
      // Gunakan string enum agar aman diproses komponen UI.
      iconType: "buy",
    };
  }

  if (normalizedSignal === "sell") {
    return {
      signal: "SELL",
      color: isDarkMode ? "bg-red-900 text-red-300" : "bg-red-100 text-red-700",
      iconType: "sell",
    };
  }

  return {
    signal: "NEUTRAL",
    color: isDarkMode
      ? "bg-gray-700 text-gray-300"
      : "bg-gray-100 text-gray-700",
    iconType: "neutral",
  };
};

// Validasi sinyal agar hanya menerima buy, sell, atau neutral.
export const safeSignal = (signal) => {
  if (!signal) return "neutral";
  const normalized = signal.toLowerCase();

  // Jika sinyal tidak valid, fallback ke neutral agar aplikasi tetap stabil.
  if (!["buy", "sell", "neutral"].includes(normalized)) {
    console.warn(
      "⚠️ [INVALID SIGNAL] Received:",
      signal,
      "→ Defaulting to neutral",
    );
    return "neutral";
  }

  return normalized;
};

// Hitung jumlah sinyal buy/sell/neutral berdasarkan data indikator dari database.
export const countSignalsFromDB = (indicators) => {
  if (!indicators) {
    return { buy: 0, sell: 0, neutral: 0 };
  }

  const signals = Object.values(indicators).map((ind) =>
    safeSignal(ind?.signal),
  );

  return {
    buy: signals.filter((s) => s === "buy").length,
    sell: signals.filter((s) => s === "sell").length,
    neutral: signals.filter((s) => s === "neutral").length,
  };
};

// Parse indikator dari API menjadi tiga kategori utama: trend, momentum, volatility.
export const parseIndicators = (indicators = {}, price = 0, weights = null) => {
  // Jangan pakai default weight agar user tahu bobot belum dioptimasi.
  const finalWeights =
    weights && Object.keys(weights).length > 0 ? weights : null;

  if (!finalWeights) {
    console.warn(
      "⚠️ [PARSE WARNING] Weights belum dioptimasi. Weight akan ditampilkan sebagai '-'",
    );
  } else {
  }

  const parsed = {
    trend: [],
    momentum: [],
    volatility: [],
  };

  // Parse SMA (kategori trend).
  if (indicators.sma) {
    parsed.trend.push({
      name: "SMA",
      key: "SMA",
      signal: safeSignal(indicators.sma.signal),
      weight: finalWeights?.SMA ?? null, // ✅ null if not optimized
      type: "trend",
    });
  }

  // Parse EMA (kategori trend).
  if (indicators.ema) {
    parsed.trend.push({
      name: "EMA",
      key: "EMA",
      signal: safeSignal(indicators.ema.signal),
      weight: finalWeights?.EMA ?? null,
      type: "trend",
    });
  }

  // Parse Parabolic SAR (kategori trend).
  if (indicators.parabolicSar) {
    parsed.trend.push({
      name: "Parabolic SAR",
      key: "PSAR",
      signal: safeSignal(indicators.parabolicSar.signal),
      weight: finalWeights?.PSAR ?? null,
      type: "trend",
    });
  }

  // Parse RSI (kategori momentum).
  if (indicators.rsi) {
    parsed.momentum.push({
      name: "RSI",
      key: "RSI",
      signal: safeSignal(indicators.rsi.signal),
      weight: finalWeights?.RSI ?? null,
      type: "momentum",
    });
  }

  // Parse MACD (kategori momentum).
  if (indicators.macd) {
    parsed.momentum.push({
      name: "MACD",
      key: "MACD",
      signal: safeSignal(indicators.macd.signal),
      weight: finalWeights?.MACD ?? null,
      type: "momentum",
    });
  }

  // Parse Stochastic (kategori momentum).
  if (indicators.stochastic) {
    parsed.momentum.push({
      name: "Stochastic Oscillator",
      key: "Stochastic",
      signal: safeSignal(indicators.stochastic.signal),
      weight: finalWeights?.Stochastic ?? null,
      type: "momentum",
    });
  }

  // Parse Stochastic RSI (kategori momentum).
  if (indicators.stochasticRsi) {
    parsed.momentum.push({
      name: "Stochastic RSI",
      key: "StochasticRSI",
      signal: safeSignal(indicators.stochasticRsi.signal),
      weight: finalWeights?.StochasticRSI ?? null,
      type: "momentum",
    });
  }

  // Parse Bollinger Bands (kategori volatility).
  if (indicators.bollingerBands) {
    parsed.volatility.push({
      name: "Bollinger Bands",
      key: "BollingerBands",
      signal: safeSignal(indicators.bollingerBands.signal),
      weight: finalWeights?.BollingerBands ?? null,
      type: "volatility",
    });
  }

  return parsed;
};

// Parse indikator versi detail (menampilkan sub-komponen seperti MACD Signal, Bollinger Upper, dll).
export const parseIndicatorsDetailed = (
  indicators = {},
  price = 0,
  weights = null,
) => {
  // Bobot null menandakan optimasi belum dilakukan.
  const finalWeights =
    weights && Object.keys(weights).length > 0 ? weights : null;

  if (!finalWeights) {
    console.warn(
      "⚠️ [PARSE DETAILED WARNING] Weights belum dioptimasi. Weight akan ditampilkan sebagai '-'",
    );
  }

  const parsed = {
    trend: [],
    momentum: [],
    volatility: [],
  };

  // Parse SMA detail per period.
  if (indicators.sma) {
    const periods = Object.keys(indicators.sma).filter(
      (key) => key !== "signal",
    );
    periods.forEach((period) => {
      parsed.trend.push({
        name: `SMA ${period}`,
        key: `SMA_${period}`,
        value: indicators.sma[period],
        signal: safeSignal(indicators.sma.signal),
        weight: finalWeights?.SMA ?? null,
        type: "trend",
      });
    });
  }

  // Parse EMA detail per period.
  if (indicators.ema) {
    const periods = Object.keys(indicators.ema).filter(
      (key) => key !== "signal",
    );
    periods.forEach((period) => {
      parsed.trend.push({
        name: `EMA ${period}`,
        key: `EMA_${period}`,
        value: indicators.ema[period],
        signal: safeSignal(indicators.ema.signal),
        weight: finalWeights?.EMA ?? null,
        type: "trend",
      });
    });
  }

  // Parse Parabolic SAR detail.
  if (indicators.parabolicSar?.value !== undefined) {
    parsed.trend.push({
      name: "Parabolic SAR",
      key: "PSAR",
      value: indicators.parabolicSar.value,
      signal: safeSignal(indicators.parabolicSar.signal),
      weight: finalWeights?.PSAR ?? null,
      type: "trend",
    });
  }

  // Parse RSI detail per period.
  if (indicators.rsi) {
    const periods = Object.keys(indicators.rsi).filter(
      (key) => key !== "signal",
    );
    periods.forEach((period) => {
      parsed.momentum.push({
        name: `RSI ${period}`,
        key: `RSI_${period}`,
        value: indicators.rsi[period],
        signal: safeSignal(indicators.rsi.signal),
        weight: finalWeights?.RSI ?? null,
        type: "momentum",
      });
    });
  }

  // Parse MACD menjadi tiga baris: MACD, signal line, dan histogram.
  if (indicators.macd) {
    const macdSignal = safeSignal(indicators.macd.signal);

    parsed.momentum.push({
      name: "MACD",
      key: "MACD",
      value: indicators.macd.macd,
      signal: macdSignal,
      weight: finalWeights?.MACD ?? null,
      type: "momentum",
    });
    parsed.momentum.push({
      name: "MACD Signal",
      key: "MACD_Signal",
      value: indicators.macd.signalLine,
      signal: macdSignal,
      weight: finalWeights?.MACD ?? null,
      type: "momentum",
    });
    parsed.momentum.push({
      name: "MACD Histogram",
      key: "MACD_Histogram",
      value: indicators.macd.histogram,
      signal: macdSignal,
      weight: finalWeights?.MACD ?? null,
      type: "momentum",
    });
  }

  // Parse Stochastic (%K dan %D).
  if (indicators.stochastic) {
    const stochSignal = safeSignal(indicators.stochastic.signal);

    parsed.momentum.push({
      name: "Stochastic %K",
      key: "Stochastic_K",
      value: indicators.stochastic["%K"],
      signal: stochSignal,
      weight: finalWeights?.Stochastic ?? null,
      type: "momentum",
    });
    parsed.momentum.push({
      name: "Stochastic %D",
      key: "Stochastic_D",
      value: indicators.stochastic["%D"],
      signal: stochSignal,
      weight: finalWeights?.Stochastic ?? null,
      type: "momentum",
    });
  }

  // Parse Stochastic RSI (%K dan %D).
  if (indicators.stochasticRsi) {
    const stochRsiSignal = safeSignal(indicators.stochasticRsi.signal);

    parsed.momentum.push({
      name: "Stochastic RSI %K",
      key: "StochasticRSI_K",
      value: indicators.stochasticRsi["%K"],
      signal: stochRsiSignal,
      weight: finalWeights?.StochasticRSI ?? null,
      type: "momentum",
    });
    parsed.momentum.push({
      name: "Stochastic RSI %D",
      key: "StochasticRSI_D",
      value: indicators.stochasticRsi["%D"],
      signal: stochRsiSignal,
      weight: finalWeights?.StochasticRSI ?? null,
      type: "momentum",
    });
  }

  // Parse Bollinger Bands (upper, middle, lower).
  if (indicators.bollingerBands) {
    const bbSignal = safeSignal(indicators.bollingerBands.signal);

    parsed.volatility.push({
      name: "Bollinger Upper",
      key: "BB_Upper",
      value: indicators.bollingerBands.upper,
      signal: bbSignal,
      weight: finalWeights?.BollingerBands ?? null,
      type: "volatility",
    });
    parsed.volatility.push({
      name: "Bollinger Middle",
      key: "BB_Middle",
      value: indicators.bollingerBands.middle,
      signal: bbSignal,
      weight: finalWeights?.BollingerBands ?? null,
      type: "volatility",
    });
    parsed.volatility.push({
      name: "Bollinger Lower",
      key: "BB_Lower",
      value: indicators.bollingerBands.lower,
      signal: bbSignal,
      weight: finalWeights?.BollingerBands ?? null,
      type: "volatility",
    });
  }

  return parsed;
};

// Hitung skor kategori dari kumpulan indikator dan bobotnya.
export const calculateCategoryScore = (indicators = [], weights = {}) => {
  if (indicators.length === 0) return 0;

  let totalScore = 0;
  let totalWeight = 0;

  indicators.forEach((indicator) => {
    const weight = weights[indicator.key] || 0;
    // Bobot 0 berarti indikator tidak berkontribusi ke perhitungan.
    if (weight === 0) return;

    const signalValue =
      indicator.signal === "buy" ? 1 : indicator.signal === "sell" ? -1 : 0;

    totalScore += signalValue * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? totalScore / totalWeight : 0;
};

// Tentukan kategori aktif dari string kombinasi terbaik.
export const getActiveCategoriesFromCombo = (bestCombo = "") => {
  const combo = bestCombo.toLowerCase();
  return {
    trend: combo.includes("trend"),
    momentum: combo.includes("momentum"),
    volatility: combo.includes("volatility"),
  };
};

// Normalisasi nama indikator agar tampilan tabel lebih ringkas dan konsisten.
export const normalizeIndicatorName = (indicatorList = []) => {
  if (!indicatorList || indicatorList.length === 0) return [];

  const groups = {
    SMA: [],
    EMA: [],
    RSI: [],
    MACD: [],
    Stochastic: [],
    StochasticRSI: [],
    BollingerBands: [],
    PSAR: [],
  };

  // Kelompokkan dulu berdasarkan tipe indikator.
  indicatorList.forEach((indicator) => {
    const name = indicator.name;

    if (name.startsWith("SMA")) {
      groups.SMA.push(indicator);
    } else if (name.startsWith("EMA")) {
      groups.EMA.push(indicator);
    } else if (name.startsWith("RSI")) {
      groups.RSI.push(indicator);
    } else if (name.includes("MACD")) {
      groups.MACD.push(indicator);
    } else if (name.startsWith("Stochastic RSI")) {
      groups.StochasticRSI.push(indicator);
    } else if (name.startsWith("Stochastic")) {
      groups.Stochastic.push(indicator);
    } else if (name.includes("Bollinger")) {
      groups.BollingerBands.push(indicator);
    } else if (name.includes("Parabolic SAR")) {
      groups.PSAR.push(indicator);
    }
  });

  const normalized = [];

  // SMA: gabungkan period ke satu label.
  if (groups.SMA.length > 0) {
    const periods = groups.SMA.map((ind) => {
      const match = ind.name.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    })
      .filter((p) => p > 0)
      .sort((a, b) => a - b);

    if (periods.length > 0) {
      normalized.push({
        name: `SMA (${periods.join(", ")})`,
        key: "SMA",
        signal: groups.SMA[0].signal,
        category: groups.SMA[0].category,
        weight: groups.SMA[0].weight,
      });
    }
  }

  // EMA: gabungkan period ke satu label.
  if (groups.EMA.length > 0) {
    const periods = groups.EMA.map((ind) => {
      const match = ind.name.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    })
      .filter((p) => p > 0)
      .sort((a, b) => a - b);

    if (periods.length > 0) {
      normalized.push({
        name: `EMA (${periods.join(", ")})`,
        key: "EMA",
        signal: groups.EMA[0].signal,
        category: groups.EMA[0].category,
        weight: groups.EMA[0].weight,
      });
    }
  }

  // RSI: tampilkan period dalam label.
  if (groups.RSI.length > 0) {
    const periods = groups.RSI.map((ind) => {
      const match = ind.name.match(/\d+/);
      return match ? parseInt(match[0]) : 14;
    })
      .filter((p) => p > 0)
      .sort((a, b) => a - b);

    normalized.push({
      name: `RSI (${periods.join(", ")})`,
      key: "RSI",
      signal: groups.RSI[0].signal,
      category: groups.RSI[0].category,
      weight: groups.RSI[0].weight,
    });
  }

  // MACD: gabungkan komponen MACD/signal/histogram ke satu baris.
  if (groups.MACD.length > 0) {
    normalized.push({
      name: "MACD (12, 26, 9)",
      key: "MACD",
      signal: groups.MACD[0].signal,
      category: groups.MACD[0].category,
      weight: groups.MACD[0].weight,
    });
  }

  // Stochastic: gabungkan %K dan %D.
  if (groups.Stochastic.length > 0) {
    normalized.push({
      name: "Stochastic (14, 3)",
      key: "Stochastic",
      signal: groups.Stochastic[0].signal,
      category: groups.Stochastic[0].category,
      weight: groups.Stochastic[0].weight,
    });
  }

  // Stochastic RSI: gabungkan %K dan %D.
  if (groups.StochasticRSI.length > 0) {
    normalized.push({
      name: "Stochastic RSI",
      key: "StochasticRSI",
      signal: groups.StochasticRSI[0].signal,
      category: groups.StochasticRSI[0].category,
      weight: groups.StochasticRSI[0].weight,
    });
  }

  // Bollinger Bands: gabungkan upper/middle/lower.
  if (groups.BollingerBands.length > 0) {
    normalized.push({
      name: "Bollinger Bands (20, 2)",
      key: "BollingerBands",
      signal: groups.BollingerBands[0].signal,
      category: groups.BollingerBands[0].category,
      weight: groups.BollingerBands[0].weight,
    });
  }

  // Parabolic SAR: satu baris indikator.
  if (groups.PSAR.length > 0) {
    normalized.push({
      name: "Parabolic SAR",
      key: "PSAR",
      signal: groups.PSAR[0].signal,
      category: groups.PSAR[0].category,
      weight: groups.PSAR[0].weight,
    });
  }

  return normalized;
};
