/**
 * 📊 OVERALL SIGNAL ANALYZER (REFACTORED)
 * =========================================
 * Menggabungkan sinyal dari 8 indikator menjadi 1 sinyal final
 *
 * RULE KONSISTENSI (PENTING):
 * - Jika overallSignal = "neutral" → signalStrength HARUS = 0
 * - Jika overallSignal = "buy"/"sell" → signalStrength = ratio (0.6-1.0)
 * - Tidak boleh ada neutral dengan strength > 0
 */

export function calculateOverallSignal(signals) {
  const values = Object.values(signals).filter((v) => v !== undefined);
  const total = values.length;

  if (total === 0) {
    console.log("⚠️ [overallAnalyzer] No signals to analyze");
    return { overallSignal: "neutral", signalStrength: 0 };
  }

  const buyCount = values.filter((v) => v === "buy").length;
  const sellCount = values.filter((v) => v === "sell").length;

  const buyRatio = buyCount / total;
  const sellRatio = sellCount / total;

  // Penentuan kategori sinyal berdasarkan mayoritas indikator
  let overallSignal = "neutral";
  let signalStrength = 0; // Default untuk neutral

  if (buyRatio >= 0.7) {
    overallSignal = "strong_buy";
    signalStrength = buyRatio;
  } else if (buyRatio >= 0.6) {
    overallSignal = "buy";
    signalStrength = buyRatio;
  } else if (sellRatio >= 0.7) {
    overallSignal = "strong_sell";
    signalStrength = sellRatio;
  } else if (sellRatio >= 0.6) {
    overallSignal = "sell";
    signalStrength = sellRatio;
  } else {
    // ✅ CRITICAL FIX: Jika neutral, strength HARUS 0
    overallSignal = "neutral";
    signalStrength = 0; // Tidak pakai Math.max(buyRatio, sellRatio)
  }

  // ✅ VALIDATION: Double-check konsistensi
  if (overallSignal === "neutral" && signalStrength !== 0) {
    console.error(
      "❌ [overallAnalyzer] MISMATCH DETECTED: neutral with strength > 0!"
    );
    signalStrength = 0; // Force fix
  }

  return { overallSignal, signalStrength };
}
