export {
  calculateSignals, // Hitung sinyal per indikator dari data terkini
} from "./signalAnalyzer.js";

export {
  calculateOverallSignal, // Hitung sinyal overall dari gabungan indikator
} from "./overallAnalyzer.js";

export {
  detectAndNotifyMultiIndicatorSignals, // Deteksi sinyal multi-indikator dan kirim notifikasi
  detectAndNotifyAllSymbols, // Jalankan deteksi sinyal untuk banyak simbol
  autoOptimizeCoinsWithoutWeights, // Optimasi otomatis untuk coin tanpa bobot
} from "./signal-detection.service.js";
