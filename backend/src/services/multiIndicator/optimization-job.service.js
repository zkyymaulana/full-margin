// menyimpan semua job optimasi yang sedang berjalan
// format: symbol -> { status, progress, result, sseClients, cancelRequested }
const optimizationJobs = new Map();

// buat job baru
export function createJob(symbol) {
  const job = {
    symbol,
    status: "waiting",
    progress: null,
    result: null,
    error: null,
    sseClients: new Set(),
    cancelRequested: false,
    startedAt: null,
    completedAt: null,
  };

  optimizationJobs.set(symbol, job);
  console.log(`[JOB] Created job for ${symbol}`);
  return job;
}

// ambil job berdasarkan symbol
export function getJob(symbol) {
  return optimizationJobs.get(symbol) || null;
}

// update data job
export function updateJob(symbol, updates) {
  const job = optimizationJobs.get(symbol);

  if (!job) {
    console.warn(`[JOB] Job tidak ditemukan untuk ${symbol}`);
    return null;
  }

  const updatedJob = { ...job, ...updates };
  optimizationJobs.set(symbol, updatedJob);

  return updatedJob;
}

// tambah client SSE ke job
export function addSSEClient(symbol, client) {
  let job = optimizationJobs.get(symbol);

  if (!job) {
    job = createJob(symbol);
  }

  if (!job.sseClients) {
    job.sseClients = new Set();
  }

  job.sseClients.add(client);
  optimizationJobs.set(symbol, job);

  console.log(
    `[JOB] SSE client ditambahkan untuk ${symbol} (total: ${job.sseClients.size})`,
  );
}

// hapus client SSE dari job
export function removeSSEClient(symbol, client) {
  const job = optimizationJobs.get(symbol);

  if (!job || !job.sseClients) return;

  job.sseClients.delete(client);
  console.log(
    `[JOB] SSE client dihapus untuk ${symbol} (sisa: ${job.sseClients.size})`,
  );

  // hapus job jika tidak ada client dan tidak running
  if (job.sseClients.size === 0 && job.status !== "running") {
    removeJob(symbol);
  }
}

// tandai job untuk dibatalkan
export function cancelJob(symbol) {
  const job = optimizationJobs.get(symbol);

  if (!job) {
    console.warn(`[JOB] Job tidak ditemukan untuk ${symbol}`);
    return false;
  }

  job.cancelRequested = true;
  job.status = "cancelled";
  optimizationJobs.set(symbol, job);

  console.log(`[JOB] Job dibatalkan untuk ${symbol}`);
  return true;
}

// cek apakah job diminta cancel
export function isCancelRequested(symbol) {
  const job = optimizationJobs.get(symbol);
  return job ? job.cancelRequested === true : false;
}

// hapus job dari memory
export function removeJob(symbol) {
  const exists = optimizationJobs.has(symbol);

  if (exists) {
    optimizationJobs.delete(symbol);
    console.log(`[JOB] Job dihapus untuk ${symbol}`);
  }

  return exists;
}

// ambil semua client SSE dari job
export function getSSEClients(symbol) {
  const job = optimizationJobs.get(symbol);
  return job?.sseClients || new Set();
}

// ambil semua job yang sedang running
export function getRunningJobs() {
  return Array.from(optimizationJobs.values()).filter(
    (job) => job.status === "running",
  );
}

// hapus semua job (biasanya saat shutdown)
export function clearAllJobs() {
  const count = optimizationJobs.size;
  optimizationJobs.clear();
  console.log(`[JOB] Semua ${count} jobs dibersihkan`);
}
