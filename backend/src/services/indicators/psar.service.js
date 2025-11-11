// === PARABOLIC SAR CALCULATOR ===
// Digunakan untuk menentukan arah tren dan potensi pembalikan harga (reversal).
export function createParabolicSARCalculator(step = 0.02, maxStep = 0.2) {
  let sar = null; // Nilai SAR saat ini
  let isUptrend = true; // Arah tren: true = naik, false = turun
  let af = step; // Acceleration Factor (mulai dari 0.02)
  let ep = null; // Extreme Point (harga tertinggi atau terendah)
  let initialized = false;
  let prevHigh = null;
  let prevLow = null;

  return {
    calculate(high, low) {
      if (!initialized) {
        sar = low; // SAR awal = harga low pertama
        ep = high; // EP awal = harga high pertama
        prevHigh = high;
        prevLow = low;
        initialized = true;
        return {
          value: sar,
          step: step,
          maxStep: maxStep,
        };
      }

      // Rumus Parabolic SAR:
      // SAR(t) = SAR(t−1) + AF × (EP − SAR(t−1))
      const prevSAR = sar;
      sar = prevSAR + af * (ep - prevSAR);

      if (isUptrend) {
        // Dalam tren naik: SAR tidak boleh di atas low sebelumnya
        sar = Math.min(sar, prevLow, low);

        // Jika harga turun di bawah SAR → pembalikan (reversal)
        if (low <= sar) {
          isUptrend = false;
          sar = ep; // SAR baru jadi EP sebelumnya
          af = step; // Reset AF
          ep = low; // EP baru = low saat ini
        } else {
          // Jika high baru lebih tinggi → update EP dan percepat AF
          if (high > ep) {
            ep = high;
            af = Math.min(af + step, maxStep);
          }
        }
      } else {
        // Dalam tren turun: SAR tidak boleh di bawah high sebelumnya
        sar = Math.max(sar, prevHigh, high);

        // Jika harga naik di atas SAR → pembalikan tren ke atas
        if (high >= sar) {
          isUptrend = true;
          sar = ep;
          af = step;
          ep = high;
        } else {
          // Jika low baru lebih rendah → update EP & AF
          if (low < ep) {
            ep = low;
            af = Math.min(af + step, maxStep);
          }
        }
      }

      prevHigh = high;
      prevLow = low;

      return {
        value: sar,
        step: step,
        maxStep: maxStep,
      };
    },
  };
}
