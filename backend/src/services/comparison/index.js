// service utama untuk menjalankan proses comparison
export { compareStrategies } from "./comparison.service.js";

// fungsi untuk validasi input dan penanganan error
export {
  validateComparisonParams, // validasi parameter input comparison
  handleComparisonError, // menangani error dari proses comparison
} from "./comparison.validation.js";

// fungsi-fungsi untuk perhitungan metrics dan analisis performa
export {
  mean, // menghitung rata-rata
  stddev, // menghitung standar deviasi
  calcSharpe, // menghitung rasio sharpe
  calculateReturns, // menghitung return dari equity curve
  calculateMaxDrawDown, // menghitung drawdown maksimum
  formatResult, // merapikan hasil backtest
} from "./comparison.metrics.js";

// fungsi untuk voting strategy (logika sinyal dan backtest)
export {
  votingSignal, // menghasilkan sinyal berdasarkan voting indikator
  backtestVotingStrategy, // menjalankan backtest voting strategy
} from "./comparison.backtest.js";

// fungsi untuk pengolahan data (merge data dan ambil bobot indikator)
export {
  mergeIndicatorsWithCandles, // menggabungkan data indikator dan candle
  getBestWeights, // mengambil bobot terbaik dari database atau default
  defaultWeights, // bobot default indikator
} from "./comparison.data.js";
