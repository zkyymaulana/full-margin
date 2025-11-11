// Menggabungkan hasil sinyal individu dari berbagai indikator untuk menentukan arah pasar secara umum.
export function calculateOverallSignal(signals) {
  const values = Object.values(signals).filter((v) => v !== undefined);
  const total = values.length;

  if (total === 0) return { overallSignal: "neutral", signalStrength: 0 };

  const buyCount = values.filter((v) => v === "buy").length;
  const sellCount = values.filter((v) => v === "sell").length;

  const buyRatio = buyCount / total;
  const sellRatio = sellCount / total;

  // Penentuan kategori sinyal berdasarkan mayoritas indikator
  let overallSignal = "neutral";
  let strength = 0;

  if (buyRatio >= 0.7) {
    overallSignal = "strong_buy";
    strength = buyRatio;
  } else if (buyRatio >= 0.6) {
    overallSignal = "buy";
    strength = buyRatio;
  } else if (sellRatio >= 0.7) {
    overallSignal = "strong_sell";
    strength = sellRatio;
  } else if (sellRatio >= 0.6) {
    overallSignal = "sell";
    strength = sellRatio;
  } else {
    overallSignal = "neutral";
    strength = Math.max(buyRatio, sellRatio);
  }

  return { overallSignal, signalStrength: strength };
}
