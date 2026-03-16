/**
 * 🎮 Controller Multi-Indicator
 * ================================================================
 * Thin controller layer yang hanya menangani HTTP requests/responses.
 *
 * Tanggung Jawab:
 * - Parse request parameters
 * - Validate input
 * - Call service functions
 * - Return JSON responses
 *
 * TIDAK BOLEH MENGANDUNG:
 * - Business logic
 * - Database queries (gunakan service)
 * - Algorithm logic (gunakan service)
 * - Job state management (gunakan service)
 * ================================================================
 */

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
} from "../services/multiIndicator/index.js";
import { calculateCategoryScores } from "../utils/multiindicator-score.utils.js";
import jwt from "jsonwebtoken";

/**
 * 🔐 Middleware: Verify JWT token untuk SSE endpoints
 * SSE tidak support HTTP headers, jadi token dipass via query parameter
 */
async function verifySSEToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (err) {
    throw new Error("Invalid or expired token");
  }
}

/**
 * 📊 GET /api/multi-indicator/:symbol/estimate
 *
 * Dapatkan estimasi waktu optimization untuk symbol tertentu.
 *
 * Query parameters:
 * - timeframe: "1h" (default), "4h", "1d", etc.
 *
 * Response: {estimate, dataPoints, totalCombinations, ...}
 */
export async function getOptimizationEstimateController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    console.log(
      `\n📊 [CONTROLLER] Getting estimate for ${symbol} (${timeframe})`
    );

    // Call service untuk get estimate
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

/**
 * 📡 GET /api/multi-indicator/:symbol/stream?token=JWT_TOKEN
 *
 * SSE endpoint untuk streaming optimization progress.
 *
 * Clients connect ke endpoint ini dan menerima real-time updates:
 * - start: Optimization dimulai
 * - progress: Progress update setiap 1000 kombinasi
 * - completed: Optimization selesai
 * - cancelled: Optimization dibatalkan
 * - error: Error terjadi
 *
 * Query parameters:
 * - token: JWT authentication token (REQUIRED)
 * - timeframe: "1h" (default)
 *
 * Response: Server-Sent Events stream
 */
export async function streamOptimizationProgressController(req, res) {
  const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
  const token = req.query.token;

  try {
    // ✅ Verify JWT token dari query parameter
    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication token required. Use ?token=YOUR_TOKEN",
      });
      return;
    }

    const user = await verifySSEToken(token);
    console.log(`📡 [SSE] Authenticated user: ${user.email} for ${symbol}`);

    // ================================================================================
    // STEP 1: Setup SSE Response Headers
    // ================================================================================
    setupSSE(res);
    console.log(`📡 [SSE] SSE headers configured for ${symbol}`);

    // ================================================================================
    // STEP 2: CREATE/GET JOB dan TAMBAHKAN CLIENT ke JOB
    // ================================================================================
    // PENTING: Tambahkan SSE client ke job state
    // Ini memungkinkan backend untuk broadcast ke client saat progress update
    createJob(symbol);
    addSSEClient(symbol, res); // ← ADD CLIENT KE JOB!
    const job = getJob(symbol);

    console.log(
      `📡 [SSE] Client added to job for ${symbol}. Total clients: ${getSSEClients(symbol).size}`
    );

    // ================================================================================
    // STEP 3: SEND CURRENT JOB STATE ke CLIENT
    // ================================================================================
    // Jika job sedang running, kirim current progress
    if (job?.status === "running" && job?.progress) {
      console.log(`📡 [SSE] Job running, sending current progress`);
      sendEvent(res, "progress", job.progress);
    }
    // Jika job sudah completed, kirim hasil
    else if (job?.status === "completed" && job?.result) {
      console.log(`📡 [SSE] Job completed, sending result`);
      sendEvent(res, "completed", job.result);
      res.end();
      return;
    }
    // Jika ada error, kirim error message
    else if (job?.status === "error" && job?.error) {
      console.log(`📡 [SSE] Job error, sending error message`);
      sendEvent(res, "error", { message: job.error });
      res.end();
      return;
    }
    // Otherwise, kirim status waiting
    else {
      console.log(`📡 [SSE] Job waiting, sending status message`);
      sendEvent(res, "status", {
        status: job?.status || "waiting",
        message: "Waiting for optimization to start...",
      });
    }

    // ================================================================================
    // STEP 4: Setup Heartbeat untuk Keep Connection Alive
    // ================================================================================
    // Kirim heartbeat setiap 30 detik untuk prevent timeout
    const heartbeatInterval = setupHeartbeat(res, 30000);

    // ================================================================================
    // STEP 5: Handle Client Disconnect
    // ================================================================================
    req.on("close", () => {
      console.log(`📡 [SSE] Client disconnected for ${symbol}`);
      clearInterval(heartbeatInterval);
      // Jangan hapus job, hanya disconnect client
      // Job state tetap ada untuk client lain yang mungkin masih connected
    });

    req.on("error", (err) => {
      console.error(`📡 [SSE] Client error for ${symbol}:`, err.message);
      clearInterval(heartbeatInterval);
    });
  } catch (err) {
    console.error(`❌ [SSE] Error in stream controller:`, err.message);
    res.status(401).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * 🛑 POST /api/multi-indicator/:symbol/cancel
 *
 * Cancel optimization yang sedang berjalan.
 *
 * Response: {success: true, message: "..."}
 */
export async function cancelOptimizationController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();

    console.log(`🛑 [CONTROLLER] Cancel request for ${symbol}`);

    // Cancel job via job service
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

    // Mark as cancelled
    cancelJob(symbol);

    // Broadcast cancellation ke semua SSE clients
    const clients = getSSEClients(symbol);
    broadcastEvent(clients, "cancelled", {
      message: "Optimization cancelled by user",
      symbol,
    });

    // Close SSE connections
    setTimeout(() => {
      closeAllSSE(clients);
    }, 1000);

    // Clean up job setelah 1 menit
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

/**
 * 🚀 POST /api/multi-indicator/:symbol/optimize-weights
 *
 * Jalankan optimization untuk cryptocurrency symbol tertentu.
 *
 * Query parameters:
 * - timeframe: "1h" (default)
 * - force: "true" untuk force reoptimization
 *
 * Body:
 * - force: boolean (alternative ke query parameter)
 *
 * Response:
 * {
 *   success: true,
 *   symbol: "BTC-USD",
 *   timeframe: "1h",
 *   lastOptimized: ISO datetime,
 *   performance: {roi, winRate, maxDrawdown, ...},
 *   weights: {SMA: 2, EMA: 1, ...},
 *   categoryScores: {trend, momentum, volatility},
 *   latest: {time, open, high, low, close, volume}
 * }
 */
export async function optimizeIndicatorWeightsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = (req.query.timeframe || "1h").toLowerCase();
    const forceReoptimize =
      req.body.force === true || req.query.force === "true";

    console.log(
      `\n🚀 [CONTROLLER] Starting optimization for ${symbol} (${timeframe})`
    );

    if (forceReoptimize) {
      console.log(`   🔄 Force reoptimization enabled`);
    }

    // ================================================================================
    // STEP 1: CREATE JOB & MARK STATUS = "running" IMMEDIATELY
    // ================================================================================
    // PENTING: Update status ke "running" SEBELUM optimization dimulai
    // Ini memastikan SSE clients dapat connect dan ditambahkan ke job
    createJob(symbol);
    updateJob(symbol, {
      status: "running",
      startedAt: new Date().toISOString(),
    });
    console.log(`✅ Job created for ${symbol} - status: running`);

    // Setup callbacks untuk progress tracking
    const onProgress = (progressData) => {
      const job = getJob(symbol);
      if (job) {
        job.progress = progressData;
        updateJob(symbol, { progress: progressData });

        // Broadcast ke SSE clients
        const clients = getSSEClients(symbol);
        console.log(
          `📡 Broadcasting progress to ${clients.size} clients for ${symbol}`
        );
        broadcastEvent(clients, "progress", progressData);
      }
    };

    const checkCancel = () => {
      return isCancelRequested(symbol);
    };

    // ================================================================================
    // STEP 2: CALL SERVICE - OPTIMIZATION DIMULAI
    // ================================================================================
    // Call service untuk run optimization
    // Pada tahap ini, SSE clients sudah bisa connect karena job status = "running"
    console.log(`🔄 Starting optimization service for ${symbol}...`);
    const result = await runOptimization(symbol, timeframe, {
      forceReoptimize,
      onProgress,
      checkCancel,
    });

    if (result.cancelled) {
      // ================================================================================
      // CANCELLED: Broadcast cancellation dan cleanup
      // ================================================================================
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

    // ================================================================================
    // STEP 3: COMPLETED - Broadcast hasil dan cleanup
    // ================================================================================
    console.log(`✅ Optimization completed for ${symbol}`);

    // Calculate category scores
    const categoryScores = calculateCategoryScores(
      result.latest || {},
      result.weights || {}
    );

    // Mark job as completed
    updateJob(symbol, {
      status: "completed",
      result,
      completedAt: new Date().toISOString(),
    });

    // Broadcast completion to SSE clients
    const clients = getSSEClients(symbol);
    console.log(
      `📡 Broadcasting completion to ${clients.size} clients for ${symbol}`
    );
    broadcastEvent(clients, "completed", {
      success: true,
      performance: result.performance,
      weights: result.weights,
      categoryScores,
    });

    // Close SSE connections setelah 1 detik
    setTimeout(() => {
      closeAllSSE(clients);
    }, 1000);

    // Clean up job setelah 5 menit
    setTimeout(
      () => {
        removeJob(symbol);
      },
      5 * 60 * 1000
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
    });
  } catch (err) {
    console.error("❌ Error in optimization:", err.message);

    // ================================================================================
    // ERROR HANDLING: Broadcast error dan cleanup
    // ================================================================================
    const errorSymbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const job = getJob(errorSymbol);
    if (job) {
      updateJob(errorSymbol, {
        status: "error",
        error: err.message,
      });

      // Broadcast error ke SSE clients
      const clients = getSSEClients(errorSymbol);
      console.log(
        `📡 Broadcasting error to ${clients.size} clients for ${errorSymbol}`
      );
      broadcastEvent(clients, "error", {
        message: err.message,
      });
      closeAllSSE(clients);

      // Clean up
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

/**
 * 🔄 POST /api/multi-indicator/optimize-all
 *
 * Optimize semua top 20 coins dalam satu batch job.
 *
 * Query parameters:
 * - timeframe: "1h" (default)
 *
 * Response:
 * {
 *   success: true,
 *   message: "Optimasi selesai (...)",
 *   count: 20,
 *   successCount: 15,
 *   skippedCount: 3,
 *   failedCount: 2,
 *   results: [...]
 * }
 */
export async function optimizeAllCoinsController(req, res) {
  try {
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    console.log(`\n🔄 [CONTROLLER] Starting batch optimization for all coins`);

    // Call service untuk optimize semua coins
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

/**
 * 📊 POST /api/multi-indicator/:symbol/backtest
 *
 * Jalankan backtest dengan weights yang sudah dioptimalkan.
 *
 * Query parameters:
 * - timeframe: "1h" (default)
 *
 * Response:
 * {
 *   success: true,
 *   symbol: "BTC-USD",
 *   performance: {roi, winRate, maxDrawdown, ...},
 *   weights: {...},
 *   totalData: 45893
 * }
 */
export async function backtestWithOptimizedWeightsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    console.log(
      `\n📊 [CONTROLLER] Starting backtest for ${symbol} (${timeframe})`
    );

    // Call service untuk run backtest
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

/**
 * 🛑 Server Shutdown Handler
 *
 * Graceful shutdown: Cancel all running optimizations dan close SSE connections
 */
function handleServerShutdown() {
  console.log("\n🛑 Server shutting down, cancelling all optimizations...");

  // Broadcast shutdown to all running jobs
  const runningJobs = getRunningJobs();
  for (const job of runningJobs) {
    console.log(`📡 Broadcasting shutdown for ${job.symbol}`);

    broadcastEvent(job.sseClients, "cancelled", {
      type: "cancelled",
      message: "Server is restarting. Please try again.",
      reason: "server_restart",
      symbol: job.symbol,
    });

    // Close connections
    setTimeout(() => {
      closeAllSSE(job.sseClients);
    }, 500);
  }

  // Clear all jobs
  clearAllJobs();

  // Exit
  setTimeout(() => {
    console.log("👋 Goodbye!");
    process.exit(0);
  }, 1000);
}

// Setup shutdown handlers
process.on("SIGINT", handleServerShutdown);
process.on("SIGTERM", handleServerShutdown);

export default {
  getOptimizationEstimateController,
  streamOptimizationProgressController,
  cancelOptimizationController,
  optimizeIndicatorWeightsController,
  optimizeAllCoinsController,
  backtestWithOptimizedWeightsController,
};
