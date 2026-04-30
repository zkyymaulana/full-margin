// service utama optimasi
export {
  getOptimizationEstimate, // hitung estimasi durasi optimasi
  runOptimization, // jalankan proses optimasi utama
  runBacktestWithOptimizedWeights, // backtest dengan bobot hasil optimasi
  optimizeAllCoins, // optimasi untuk banyak coin sekaligus
} from "./optimization.service.js";

// service untuk manajemen job optimasi
export {
  createJob, // buat job baru
  getJob, // ambil data job
  updateJob, // update status atau progress job
  addSSEClient, // tambah client SSE ke job
  removeSSEClient, // hapus client SSE dari job
  cancelJob, // tandai job untuk dibatalkan
  isCancelRequested, // cek apakah job diminta cancel
  removeJob, // hapus job dari memory
  getSSEClients, // ambil semua client SSE dalam job
  getRunningJobs, // ambil daftar job yang sedang berjalan
  clearAllJobs, // hapus semua job
} from "./optimization-job.service.js";

// service untuk SSE (streaming realtime)
export {
  setupSSE, // setup koneksi SSE
  sendEvent, // kirim event ke client
  broadcastEvent, // kirim event ke banyak client
  setupHeartbeat, // kirim heartbeat agar koneksi tetap hidup
  closeSSE, // tutup satu koneksi SSE
  closeAllSSE, // tutup semua koneksi SSE
} from "./sse.service.js";

// service core multi-indicator (algoritma optimasi & backtest)
export {
  optimizeIndicatorWeights, // mencari kombinasi bobot terbaik
  backtestWithWeights, // uji performa dengan bobot tertentu
} from "./multi-indicator.service.js";
