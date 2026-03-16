/**
 * 📋 Layanan Manajemen Job Optimasi
 * ================================================================
 * Service untuk mengelola state dari optimization jobs yang sedang berjalan.
 *
 * Tanggung Jawab:
 * - Menyimpan state job (status, progress, hasil)
 * - Melacak SSE clients yang terhubung
 * - Menangani request pembatalan (cancel)
 * - Membersihkan finished jobs
 * ================================================================
 */

// Global Map untuk melacak semua optimization jobs yang sedang berjalan
// Format: Symbol -> { status, progress, result, error, sseClients: Set, cancelRequested: boolean }
const optimizationJobs = new Map();

/**
 * 🆕 Buat job baru untuk simbol tertentu
 * @param {string} symbol - Simbol cryptocurrency (e.g., "BTC-USD")
 * @returns {Object} Job state yang baru dibuat
 */
export function createJob(symbol) {
  const job = {
    symbol,
    status: "waiting", // waiting | running | completed | error | cancelled
    progress: null,
    result: null,
    error: null,
    sseClients: new Set(),
    cancelRequested: false,
    startedAt: null,
    completedAt: null,
  };

  optimizationJobs.set(symbol, job);
  console.log(`✅ [JOB] Created job for ${symbol}`);
  return job;
}

/**
 * 📍 Dapatkan job state untuk simbol tertentu
 * @param {string} symbol - Simbol cryptocurrency
 * @returns {Object|null} Job state atau null jika tidak ada
 */
export function getJob(symbol) {
  return optimizationJobs.get(symbol) || null;
}

/**
 * 🔄 Update job state dengan data baru
 * @param {string} symbol - Simbol cryptocurrency
 * @param {Object} updates - Data yang akan diupdate
 * @returns {Object} Job state yang sudah diupdate
 */
export function updateJob(symbol, updates) {
  const job = optimizationJobs.get(symbol);

  if (!job) {
    console.warn(`⚠️ [JOB] Job tidak ditemukan untuk ${symbol}`);
    return null;
  }

  const updatedJob = { ...job, ...updates };
  optimizationJobs.set(symbol, updatedJob);

  return updatedJob;
}

/**
 * ➕ Tambahkan SSE client ke job
 * @param {string} symbol - Simbol cryptocurrency
 * @param {Object} client - Response object dari Express
 */
export function addSSEClient(symbol, client) {
  let job = optimizationJobs.get(symbol);

  if (!job) {
    // Jika job belum ada, buat job baru dengan status waiting
    job = createJob(symbol);
  }

  if (!job.sseClients) {
    job.sseClients = new Set();
  }

  job.sseClients.add(client);
  optimizationJobs.set(symbol, job);

  console.log(
    `📡 [JOB] SSE client ditambahkan untuk ${symbol} (total: ${job.sseClients.size})`
  );
}

/**
 * ➖ Hapus SSE client dari job
 * @param {string} symbol - Simbol cryptocurrency
 * @param {Object} client - Response object dari Express
 */
export function removeSSEClient(symbol, client) {
  const job = optimizationJobs.get(symbol);

  if (!job || !job.sseClients) {
    return;
  }

  job.sseClients.delete(client);
  console.log(
    `📡 [JOB] SSE client dihapus untuk ${symbol} (sisa: ${job.sseClients.size})`
  );

  // Jika tidak ada client dan job tidak running, hapus job
  if (job.sseClients.size === 0 && job.status !== "running") {
    removeJob(symbol);
  }
}

/**
 * 🛑 Tandai job untuk dibatalkan
 * @param {string} symbol - Simbol cryptocurrency
 * @returns {boolean} true jika berhasil, false jika job tidak ada
 */
export function cancelJob(symbol) {
  const job = optimizationJobs.get(symbol);

  if (!job) {
    console.warn(`⚠️ [JOB] Job tidak ditemukan untuk ${symbol}`);
    return false;
  }

  job.cancelRequested = true;
  job.status = "cancelled";
  optimizationJobs.set(symbol, job);

  console.log(`🛑 [JOB] Job dibatalkan untuk ${symbol}`);
  return true;
}

/**
 * ✅ Check apakah job sudah diminta untuk dibatalkan
 * @param {string} symbol - Simbol cryptocurrency
 * @returns {boolean} true jika cancel diminta, false sebaliknya
 */
export function isCancelRequested(symbol) {
  const job = optimizationJobs.get(symbol);
  return job ? job.cancelRequested === true : false;
}

/**
 * 🧹 Hapus job dari state management
 * @param {string} symbol - Simbol cryptocurrency
 * @returns {boolean} true jika berhasil dihapus, false jika tidak ada
 */
export function removeJob(symbol) {
  const exists = optimizationJobs.has(symbol);

  if (exists) {
    optimizationJobs.delete(symbol);
    console.log(`🧹 [JOB] Job dihapus untuk ${symbol}`);
  }

  return exists;
}

/**
 * 📊 Dapatkan semua SSE clients untuk job tertentu
 * @param {string} symbol - Simbol cryptocurrency
 * @returns {Set} Set dari SSE clients atau empty set
 */
export function getSSEClients(symbol) {
  const job = optimizationJobs.get(symbol);
  return job?.sseClients || new Set();
}

/**
 * 🔍 Dapatkan semua jobs yang sedang running
 * @returns {Array} Array dari job objects yang status-nya "running"
 */
export function getRunningJobs() {
  return Array.from(optimizationJobs.values()).filter(
    (job) => job.status === "running"
  );
}

/**
 * 🔥 Bersihkan semua jobs (untuk shutdown)
 */
export function clearAllJobs() {
  const count = optimizationJobs.size;
  optimizationJobs.clear();
  console.log(`🔥 [JOB] Semua ${count} jobs dibersihkan`);
}

export default {
  createJob,
  getJob,
  updateJob,
  addSSEClient,
  removeSSEClient,
  cancelJob,
  isCancelRequested,
  removeJob,
  getSSEClients,
  getRunningJobs,
  clearAllJobs,
};
