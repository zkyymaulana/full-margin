// Controller Multi-Indicator: fokus pada HTTP request/response.
// Business logic tetap dijalankan di service.

import {
  getOptimizationEstimate,
  runOptimization,
  createJob,
  getJob,
  updateJob,
  removeJob,
  getSSEClients,
  cancelJob,
  isCancelRequested,
  setupSSE,
  sendEvent,
  broadcastEvent,
  closeAllSSE,
  setupHeartbeat,
  runBacktestWithOptimizedWeights,
  optimizeAllCoins,
  getRunningJobs,
  clearAllJobs,
  addSSEClient,
  removeSSEClient,
} from "../services/multiIndicator/index.js";
import { calculateCategoryScores } from "../utils/multiindicator-score.utils.js";
import { prisma } from "../lib/prisma.js";
import jwt from "jsonwebtoken";

// Verifikasi token JWT untuk endpoint SSE (token dikirim via query).
async function verifySSEToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (err) {
    throw new Error("Invalid or expired token");
  }
}

// Ambil estimasi waktu optimasi untuk satu simbol.
export async function getOptimizationEstimateController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    console.log(
      `\n📊 [CONTROLLER] Getting estimate for ${symbol} (${timeframe})`,
    );

    // Delegasikan perhitungan estimasi ke service.
    const estimate = await getOptimizationEstimate(symbol, timeframe);

    res.json({
      success: true,
      symbol,
      timeframe,
      estimate,
    });
  } catch (err) {
    console.error("❌ Error getting estimate:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

// Stream progress optimasi via SSE agar frontend menerima update realtime.
export async function streamOptimizationProgressController(req, res) {
  const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
  const token = req.query.token;

  try {
    // Verifikasi token user sebelum membuka koneksi SSE.
    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication token required. Use ?token=YOUR_TOKEN",
      });
      return;
    }

    const user = await verifySSEToken(token);
    console.log(`📡 [SSE] Authenticated user: ${user.email} for ${symbol}`);

    // Langkah 1: siapkan header SSE.
    setupSSE(res);
    console.log(`📡 [SSE] SSE headers configured for ${symbol}`);

    // Langkah 2: ambil/buat job lalu daftarkan client ke job.
    if (!getJob(symbol)) {
      createJob(symbol);
    }
    addSSEClient(symbol, res); // ← ADD CLIENT KE JOB!
    const job = getJob(symbol);

    console.log(
      `📡 [SSE] Client added to job for ${symbol}. Total clients: ${getSSEClients(symbol).size}`,
    );

    // Langkah 3: kirim status job saat ini ke client yang baru connect.
    if (job?.status === "running" && job?.progress) {
      console.log(`📡 [SSE] Job running, sending current progress`);
      sendEvent(res, "progress", job.progress);
    }
    // Jika job sudah selesai, kirim hasil lalu tutup stream.
    else if (job?.status === "completed" && job?.result) {
      console.log(`📡 [SSE] Job completed, sending result`);
      sendEvent(res, "completed", job.result);
      res.end();
      return;
    }
    // Jika job error, kirim pesan error lalu tutup stream.
    else if (job?.status === "error" && job?.error) {
      console.log(`📡 [SSE] Job error, sending error message`);
      sendEvent(res, "error", { message: job.error });
      res.end();
      return;
    }
    // Selain kondisi di atas, kirim status menunggu.
    else {
      console.log(`📡 [SSE] Job waiting, sending status message`);
      sendEvent(res, "status", {
        status: job?.status || "waiting",
        message: "Waiting for optimization to start...",
      });
    }

    // Langkah 4: heartbeat berkala agar koneksi SSE tidak timeout.
    const heartbeatInterval = setupHeartbeat(res, 15000);

    // Langkah 5: bersihkan resource ketika client disconnect.
    req.on("close", () => {
      console.log(`📡 [SSE] Client disconnected for ${symbol}`);
      clearInterval(heartbeatInterval);
      removeSSEClient(symbol, res);
      // Job tidak dihapus karena bisa masih dipakai client lain.
    });

    req.on("error", (err) => {
      console.error(`📡 [SSE] Client error for ${symbol}:`, err.message);
      clearInterval(heartbeatInterval);
      removeSSEClient(symbol, res);
    });
  } catch (err) {
    console.error(`❌ [SSE] Error in stream controller:`, err.message);
    res.status(401).json({
      success: false,
      message: err.message,
    });
  }
}

// Ambil status job optimasi sebagai fallback saat SSE tidak tersedia.
export async function getOptimizationStatusController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const job = getJob(symbol);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: `No optimization job found for ${symbol}`,
        status: "not_found",
      });
    }

    return res.json({
      success: true,
      symbol,
      status: job.status,
      progress: job.progress || null,
      result: job.result || null,
      error: job.error || null,
      startedAt: job.startedAt || null,
      completedAt: job.completedAt || null,
      hasClients: (job.sseClients?.size || 0) > 0,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

// Batalkan proses optimasi yang sedang berjalan.
export async function cancelOptimizationController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();

    console.log(`🛑 [CONTROLLER] Cancel request for ${symbol}`);

    // Cek job aktif sebelum proses pembatalan.
    const job = getJob(symbol);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: `No active optimization found for ${symbol}`,
      });
    }

    if (job.status !== "running") {
      return res.status(400).json({
        success: false,
        message: `Optimization for ${symbol} is not running (status: ${job.status})`,
      });
    }

    // Tandai job sebagai cancelled.
    cancelJob(symbol);

    // Kirim event pembatalan ke semua client SSE.
    const clients = getSSEClients(symbol);
    broadcastEvent(clients, "cancelled", {
      message: "Optimization cancelled by user",
      symbol,
    });

    // Tutup koneksi SSE secara bertahap.
    setTimeout(() => {
      closeAllSSE(clients);
    }, 1000);

    // Hapus job dari memori setelah jeda singkat.
    setTimeout(() => {
      removeJob(symbol);
    }, 60 * 1000);

    res.json({
      success: true,
      message: `Optimization for ${symbol} has been cancelled`,
    });
  } catch (err) {
    console.error("❌ Error cancelling optimization:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

// Jalankan optimasi bobot indikator untuk simbol tertentu.
export async function optimizeIndicatorWeightsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = (req.query.timeframe || "1h").toLowerCase();
    const forceReoptimize =
      req.body.force === true || req.query.force === "true";

    console.log(
      `\n🚀 [CONTROLLER] Starting optimization for ${symbol} (${timeframe})`,
    );

    if (forceReoptimize) {
      console.log(`   🔄 Force reoptimization enabled`);
    }

    const existingJob = getJob(symbol);
    if (existingJob?.status === "running") {
      return res.status(202).json({
        success: true,
        message: `Optimization already running for ${symbol}`,
        symbol,
        timeframe,
        running: true,
      });
    }

    if (!forceReoptimize) {
      const [coin, timeframeRecord] = await Promise.all([
        prisma.coin.findUnique({
          where: { symbol },
          select: { id: true },
        }),
        prisma.timeframe.findUnique({
          where: { timeframe },
          select: { id: true },
        }),
      ]);

      if (!coin || !timeframeRecord) {
        return res.status(404).json({
          success: false,
          message: `Symbol or timeframe not found for ${symbol}`,
        });
      }

      const existingWeight = await prisma.indicatorWeight.findFirst({
        where: {
          coinId: coin.id,
          timeframeId: timeframeRecord.id,
        },
        orderBy: { updatedAt: "desc" },
      });

      if (existingWeight) {
        return res.status(200).json({
          success: true,
          message: `Asset already optimized for ${symbol}.`,
          symbol,
          timeframe,
          lastOptimized: existingWeight.updatedAt,
          performance: {
            roi: existingWeight.roi,
            winRate: existingWeight.winRate,
            maxDrawdown: existingWeight.maxDrawdown,
            sharpeRatio: existingWeight.sharpeRatio,
            trades: existingWeight.trades,
            finalCapital: existingWeight.finalCapital,
          },
          weights: existingWeight.weights,
        });
      }
    }

    // Langkah 1: buat job dan set status running sebelum optimasi dimulai.
    createJob(symbol);
    updateJob(symbol, {
      status: "running",
      startedAt: new Date().toISOString(),
    });
    console.log(`✅ Job created for ${symbol} - status: running`);

    // Callback progress untuk update status job dan broadcast SSE.
    const onProgress = (progressData) => {
      const job = getJob(symbol);
      if (job) {
        job.progress = progressData;
        updateJob(symbol, { progress: progressData });

        // Broadcast progress ke semua client SSE yang terhubung.
        const clients = getSSEClients(symbol);
        console.log(
          `📡 Broadcasting progress to ${clients.size} clients for ${symbol}`,
        );
        broadcastEvent(clients, "progress", progressData);
      }
    };

    const checkCancel = () => {
      return isCancelRequested(symbol);
    };

    // Langkah 2: jalankan service optimasi utama.
    console.log(`🔄 Starting optimization service for ${symbol}...`);
    const result = await runOptimization(symbol, timeframe, {
      forceReoptimize,
      onProgress,
      checkCancel,
    });

    if (result.cancelled) {
      // Jika dibatalkan: broadcast event cancelled dan cleanup.
      console.log(`🛑 Optimization cancelled for ${symbol}`);
      const clients = getSSEClients(symbol);
      broadcastEvent(clients, "cancelled", {
        message: "Optimization cancelled by user",
        symbol,
      });

      setTimeout(() => {
        closeAllSSE(clients);
      }, 500);

      setTimeout(() => {
        removeJob(symbol);
      }, 60 * 1000);

      return res.status(200).json(result);
    }

    // Langkah 3: jika selesai, simpan hasil lalu broadcast ke client.
    console.log(`✅ Optimization completed for ${symbol}`);

    // Hitung skor kategori untuk ringkasan hasil.
    const categoryScores = calculateCategoryScores(
      result.latestIndicator || {},
      result.weights || {},
    );

    // Ubah status job menjadi completed.
    updateJob(symbol, {
      status: "completed",
      result,
      completedAt: new Date().toISOString(),
    });

    // Broadcast hasil akhir ke client SSE.
    const clients = getSSEClients(symbol);
    console.log(
      `📡 Broadcasting completion to ${clients.size} clients for ${symbol}`,
    );
    broadcastEvent(clients, "completed", {
      success: true,
      performance: result.performance,
      weights: result.weights,
      categoryScores,
    });

    // Tutup koneksi SSE setelah hasil dikirim.
    setTimeout(() => {
      closeAllSSE(clients);
    }, 1000);

    // Hapus job dari memori setelah beberapa menit.
    setTimeout(
      () => {
        removeJob(symbol);
      },
      5 * 60 * 1000,
    );

    res.json({
      success: true,
      symbol,
      timeframe,
      lastOptimized: result.lastOptimized,
      performance: result.performance,
      weights: result.weights,
      categoryScores,
      latest: result.latest,
      latestIndicator: result.latestIndicator,
    });
  } catch (err) {
    console.error("❌ Error in optimization:", err.message);

    // Jika gagal: ubah status job ke error, broadcast, lalu cleanup.
    const errorSymbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const job = getJob(errorSymbol);
    if (job) {
      updateJob(errorSymbol, {
        status: "error",
        error: err.message,
      });

      // Kirim error ke client SSE.
      const clients = getSSEClients(errorSymbol);
      console.log(
        `📡 Broadcasting error to ${clients.size} clients for ${errorSymbol}`,
      );
      broadcastEvent(clients, "error", {
        message: err.message,
      });
      closeAllSSE(clients);

      // Hapus job dari memori setelah jeda singkat.
      setTimeout(() => {
        removeJob(errorSymbol);
      }, 60 * 1000);
    }

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

// Jalankan optimasi massal untuk semua top coin.
export async function optimizeAllCoinsController(req, res) {
  try {
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    console.log(`\n🔄 [CONTROLLER] Starting batch optimization for all coins`);

    // Delegasikan optimasi massal ke service.
    const result = await optimizeAllCoins(timeframe);

    res.json(result);
  } catch (err) {
    console.error("❌ Error optimizing all coins:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

// Jalankan backtest menggunakan bobot yang sudah dioptimasi.
export async function backtestWithOptimizedWeightsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    console.log(
      `\n📊 [CONTROLLER] Starting backtest for ${symbol} (${timeframe})`,
    );

    // Jalankan backtest melalui service.
    const result = await runBacktestWithOptimizedWeights(symbol, timeframe);

    res.json(result);
  } catch (err) {
    console.error("❌ Error in backtest:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

// Tangani graceful shutdown agar job berjalan berhenti dengan aman.
function handleServerShutdown() {
  console.log("\n🛑 Server shutting down, cancelling all optimizations...");

  // Kirim event shutdown ke semua job yang masih berjalan.
  const runningJobs = getRunningJobs();
  for (const job of runningJobs) {
    console.log(`📡 Broadcasting shutdown for ${job.symbol}`);

    broadcastEvent(job.sseClients, "cancelled", {
      type: "cancelled",
      message: "Server is restarting. Please try again.",
      reason: "server_restart",
      symbol: job.symbol,
    });

    // Tutup koneksi SSE yang tersisa.
    setTimeout(() => {
      closeAllSSE(job.sseClients);
    }, 500);
  }

  // Bersihkan seluruh data job dari memori.
  clearAllJobs();

  // Keluar dari proses setelah cleanup selesai.
  setTimeout(() => {
    console.log("👋 Goodbye!");
    process.exit(0);
  }, 1000);
}

// Daftarkan handler shutdown untuk SIGINT dan SIGTERM.
process.on("SIGINT", handleServerShutdown);
process.on("SIGTERM", handleServerShutdown);

export default {
  getOptimizationEstimateController,
  getOptimizationStatusController,
  streamOptimizationProgressController,
  cancelOptimizationController,
  optimizeIndicatorWeightsController,
  optimizeAllCoinsController,
  backtestWithOptimizedWeightsController,
};
