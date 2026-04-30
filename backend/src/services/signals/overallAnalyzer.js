import { calculateMultiIndicatorScore } from "../../utils/indicator.utils.js";

// Hitung sinyal overall berbobot dari sinyal indikator individual.
export async function calculateOverallSignal(
  signals,
  symbol,
  timeframe,
  cachedWeights = null,
) {
  // Pakai bobot cache jika tersedia (untuk batch).
  if (cachedWeights) {
    return buildOverallSignal(signals, cachedWeights);
  }

  // Import prisma di sini untuk menghindari circular dependency
  const { prisma } = await import("../../lib/prisma.js");

  // Ambil id coin dan timeframe.
  const coin = await prisma.coin.findUnique({
    where: { symbol },
    select: { id: true },
  });

  if (!coin) {
    // Fallback: bobot sama jika coin tidak ada.
    const equalWeight = 1;
    const weights = {
      SMA: equalWeight,
      EMA: equalWeight,
      RSI: equalWeight,
      MACD: equalWeight,
      BollingerBands: equalWeight,
      Stochastic: equalWeight,
      StochasticRSI: equalWeight,
      PSAR: equalWeight,
    };
    return buildOverallSignal(signals, weights);
  }

  const timeframeRecord = await prisma.timeframe.findUnique({
    where: { timeframe },
    select: { id: true },
  });

  if (!timeframeRecord) {
    // Fallback: bobot sama jika timeframe tidak ada.
    const equalWeight = 1;
    const weights = {
      SMA: equalWeight,
      EMA: equalWeight,
      RSI: equalWeight,
      MACD: equalWeight,
      BollingerBands: equalWeight,
      Stochastic: equalWeight,
      StochasticRSI: equalWeight,
      PSAR: equalWeight,
    };
    return buildOverallSignal(signals, weights);
  }

  // Ambil bobot optimasi terbaru dari database.
  const weightRecord = await prisma.indicatorWeight.findFirst({
    where: {
      coinId: coin.id,
      timeframeId: timeframeRecord.id,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!weightRecord || !weightRecord.weights) {
    // Fallback: bobot sama jika data bobot kosong.
    const equalWeight = 1;
    const weights = {
      SMA: equalWeight,
      EMA: equalWeight,
      RSI: equalWeight,
      MACD: equalWeight,
      BollingerBands: equalWeight,
      Stochastic: equalWeight,
      StochasticRSI: equalWeight,
      PSAR: equalWeight,
    };

    return buildOverallSignal(signals, weights);
  }

  // Gunakan bobot optimasi dari database.
  return buildOverallSignal(signals, weightRecord.weights);
}

// format data agar sesuai dengan kebutuhan algoritma inti, lalu panggil algoritma untuk hitung sinyal overall.
function buildOverallSignal(signals, weights) {
  // Ubah format sinyal database ke format algoritma inti.
  // Database: { smaSignal, emaSignal, rsiSignal, ... }
  // Algoritma inti: { SMA, EMA, RSI, ... }

  const signalsForCalculation = {
    SMA: signals.smaSignal || "neutral",
    EMA: signals.emaSignal || "neutral",
    RSI: signals.rsiSignal || "neutral",
    MACD: signals.macdSignal || "neutral",
    BollingerBands: signals.bbSignal || "neutral",
    Stochastic: signals.stochSignal || "neutral",
    StochasticRSI: signals.stochRsiSignal || "neutral",
    PSAR: signals.psarSignal || "neutral",
  };

  // Panggil algoritma inti (satu sumber perhitungan).
  const result = calculateMultiIndicatorScore(signalsForCalculation, weights);

  // Kembalikan format yang dibutuhkan untuk penyimpanan database.
  // Hasil algoritma inti: { finalScore, strength, signal, signalLabel, normalized }
  return {
    overallSignal: result.signal, // 'buy'/'sell'/'neutral'/'strong_buy'/'strong_sell'
    signalStrength: result.strength, // Tingkat keyakinan [0, 1]
    finalScore: result.finalScore, // Nilai ternormalisasi [-1, +1]
  };
}

// Export dengan nama yang jelas untuk kompatibilitas bila diperlukan.
export { buildOverallSignal };
