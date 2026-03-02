import { prisma } from "../lib/prisma.js";
import { optimizeIndicatorWeights } from "../services/multiIndicator/multiIndicator-analyzer.service.js";
import { backtestWithWeights } from "../services/multiIndicator/multiIndicator-backtest.service.js";
import { scoreSignal } from "../utils/indicator.utils.js";

// FIXED TRAINING WINDOW (CONSISTENT ACROSS ALL FUNCTIONS)
const FIXED_START_EPOCH = Date.parse("2020-01-01T00:00:00Z");
const FIXED_END_EPOCH = Date.parse("2025-01-01T00:00:00Z");

/* --- 🆕 Global state untuk tracking optimasi yang sedang berjalan --- */
const optimizationJobs = new Map(); // Symbol -> { status, progress, result, error, sseClients: Set, cancelRequested: false, abortController: AbortController }

/* --- 🆕 Cancel Optimization Endpoint --- */
export async function cancelOptimizationController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();

    console.log(`🛑 Cancel request received for ${symbol}`);

    const job = optimizationJobs.get(symbol);

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
    job.cancelRequested = true;
    job.status = "cancelled";
    optimizationJobs.set(symbol, job);

    console.log(`✅ Optimization cancelled for ${symbol}`);

    // Broadcast cancellation to all SSE clients
    if (job.sseClients) {
      job.sseClients.forEach((client) => {
        try {
          const payload = JSON.stringify({
            type: "cancelled",
            message: "Optimization cancelled by user",
            symbol,
          });
          client.write(`data: ${payload}\n\n`);

          if (client.socket && !client.socket.destroyed) {
            client.socket.uncork?.();
          }
        } catch (err) {
          console.error(`Error broadcasting cancel:`, err.message);
        }
      });

      // Close all SSE connections
      setTimeout(() => {
        job.sseClients.forEach((client) => {
          try {
            client.end();
          } catch (err) {
            // Ignore
          }
        });
      }, 1000);
    }

    // Clean up after 1 minute
    setTimeout(() => {
      optimizationJobs.delete(symbol);
      console.log(`🧹 Cleaned up cancelled optimization for ${symbol}`);
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

/* --- 🆕 Server Restart/Shutdown Handler --- */
process.on("SIGINT", handleServerShutdown);
process.on("SIGTERM", handleServerShutdown);

function handleServerShutdown() {
  console.log("\n🛑 Server shutting down, cancelling all optimizations...");

  // Broadcast cancellation to all active optimizations
  for (const [symbol, job] of optimizationJobs.entries()) {
    if (job.status === "running" && job.sseClients) {
      console.log(`📡 Broadcasting shutdown for ${symbol}`);

      job.sseClients.forEach((client) => {
        try {
          const payload = JSON.stringify({
            type: "cancelled",
            message: "Server is restarting. Please try again.",
            reason: "server_restart",
            symbol,
          });
          client.write(`data: ${payload}\n\n`);

          if (client.socket && !client.socket.destroyed) {
            client.socket.uncork?.();
          }

          // Close connection
          setTimeout(() => client.end(), 500);
        } catch (err) {
          console.error(`Error broadcasting shutdown:`, err.message);
        }
      });
    }
  }

  // Clear all jobs
  optimizationJobs.clear();

  // Exit after cleanup
  setTimeout(() => {
    console.log("👋 Goodbye!");
    process.exit(0);
  }, 1000);
}

/* --- 🆕 SSE Progress Endpoint --- */
export async function streamOptimizationProgressController(req, res) {
  const symbol = (req.params.symbol || "BTC-USD").toUpperCase();

  // ✅ Authenticate via query parameter token (SSE doesn't support headers)
  const token = req.query.token;

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Authentication token required. Use ?token=YOUR_TOKEN",
    });
    return;
  }

  // ✅ Verify JWT token
  try {
    const jwt = await import("jsonwebtoken");
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET);

    // Attach user to request (optional, for logging)
    req.user = decoded;
    console.log(`📡 [SSE] Authenticated user: ${decoded.email} for ${symbol}`);
  } catch (err) {
    console.error(`❌ [SSE] Invalid token:`, err.message);
    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
    return;
  }

  // ✅ Set SSE headers - CRITICAL for real-time streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  // CORS headers (if needed)
  res.setHeader("Access-Control-Allow-Origin", "*");

  // ✅ CRITICAL: Disable compression for SSE
  res.setHeader("Content-Encoding", "none");

  // ✅ Set response to unbuffered mode
  if (res.socket) {
    res.socket.setNoDelay(true);
    res.socket.setTimeout(0);
  }

  // ✅ Send headers immediately
  res.flushHeaders();

  console.log(`📡 [SSE] Client connected for ${symbol}`);

  // Get or create job state
  let job = optimizationJobs.get(symbol);

  if (!job) {
    // Initialize empty state if no job exists yet
    job = {
      status: "waiting",
      progress: null,
      result: null,
      error: null,
      sseClients: new Set(),
    };
    optimizationJobs.set(symbol, job);
  }

  // Add this client to the set
  if (!job.sseClients) {
    job.sseClients = new Set();
  }
  job.sseClients.add(res);

  // ✅ Helper function to send SSE events with IMMEDIATE flush
  const sendEvent = (eventName, data) => {
    try {
      const payload = JSON.stringify({ type: eventName, ...data });

      // ✅ Write data
      res.write(`data: ${payload}\n\n`);

      // ✅ FORCE immediate transmission using socket
      if (res.socket && !res.socket.destroyed) {
        // Force TCP send without buffering
        res.socket.uncork?.();
      }

      console.log(`📤 [SSE] Sent ${eventName} event (${payload.length} chars)`);
      return true;
    } catch (err) {
      console.error(`⚠️ [SSE] Error sending event:`, err.message);
      return false;
    }
  };

  // Send current state immediately
  if (job.status === "running" && job.progress) {
    sendEvent("progress", job.progress);
  } else if (job.status === "completed" && job.result) {
    sendEvent("completed", job.result);
    res.end();
    return;
  } else if (job.status === "error" && job.error) {
    sendEvent("error", { message: job.error });
    res.end();
    return;
  } else {
    sendEvent("status", {
      status: job.status,
      message: "Waiting for optimization to start...",
    });
  }

  // Keep connection alive with heartbeat
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`:heartbeat\n\n`);
      if (res.socket && !res.socket.destroyed) {
        res.socket.uncork?.();
      }
    } catch (err) {
      clearInterval(heartbeatInterval);
    }
  }, 15000); // Every 15 seconds

  // Handle client disconnect
  req.on("close", () => {
    console.log(`📡 [SSE] Client disconnected for ${symbol}`);
    clearInterval(heartbeatInterval);

    const currentJob = optimizationJobs.get(symbol);
    if (currentJob?.sseClients) {
      currentJob.sseClients.delete(res);

      // Clean up if no clients left and not running
      if (currentJob.sseClients.size === 0 && currentJob.status !== "running") {
        optimizationJobs.delete(symbol);
        console.log(`🧹 [SSE] Cleaned up job state for ${symbol}`);
      }
    }
  });
}

/**
 * Helper: Convert signal string to numeric value
 */
function toSignalValue(signal) {
  if (!signal) return 0;
  const normalized = signal.toLowerCase();
  if (normalized === "buy") return 1;
  if (normalized === "sell") return -1;
  return 0;
}

function calculateCategoryScores(indicators, weights) {
  // Safe weight extraction with defaults
  const w = {
    SMA: weights?.SMA || 0,
    EMA: weights?.EMA || 0,
    PSAR: weights?.PSAR || 0,
    RSI: weights?.RSI || 0,
    MACD: weights?.MACD || 0,
    Stochastic: weights?.Stochastic || 0,
    StochasticRSI: weights?.StochasticRSI || 0,
    BollingerBands: weights?.BollingerBands || 0,
  };

  // Extract signals from indicators
  const signals = {
    sma: toSignalValue(indicators?.sma?.signal),
    ema: toSignalValue(indicators?.ema?.signal),
    psar: toSignalValue(indicators?.parabolicSar?.signal),
    rsi: toSignalValue(indicators?.rsi?.signal),
    macd: toSignalValue(indicators?.macd?.signal),
    stochastic: toSignalValue(indicators?.stochastic?.signal),
    stochasticRsi: toSignalValue(indicators?.stochasticRsi?.signal),
    bb: toSignalValue(indicators?.bollingerBands?.signal),
  };

  // TREND CATEGORY (SMA + EMA + PSAR)
  const trendWeightSum = w.SMA + w.EMA + w.PSAR;
  const trendScore =
    trendWeightSum > 0
      ? (signals.sma * w.SMA + signals.ema * w.EMA + signals.psar * w.PSAR) /
        trendWeightSum
      : 0;

  // MOMENTUM CATEGORY (RSI + MACD + Stochastic + StochasticRSI)
  const momentumWeightSum = w.RSI + w.MACD + w.Stochastic + w.StochasticRSI;
  const momentumScore =
    momentumWeightSum > 0
      ? (signals.rsi * w.RSI +
          signals.macd * w.MACD +
          signals.stochastic * w.Stochastic +
          signals.stochasticRsi * w.StochasticRSI) /
        momentumWeightSum
      : 0;

  // VOLATILITY CATEGORY (BollingerBands only)
  const volatilityWeightSum = w.BollingerBands;
  const volatilityScore =
    volatilityWeightSum > 0
      ? (signals.bb * w.BollingerBands) / volatilityWeightSum
      : 0;

  return {
    trend: parseFloat(trendScore.toFixed(2)),
    momentum: parseFloat(momentumScore.toFixed(2)),
    volatility: parseFloat(volatilityScore.toFixed(2)),
  };
}

/* --- 🆕 Get Optimization Estimate --- */
export async function getOptimizationEstimateController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    console.log(`📊 Calculating optimization estimate for ${symbol}...`);
    console.log(`   Timeframe: ${timeframe}`);

    // Get coin and timeframe IDs
    console.log(`🔍 [STEP 1] Looking up coin: ${symbol}`);
    const coin = await prisma.coin.findUnique({
      where: { symbol },
      select: { id: true, name: true },
    });

    if (!coin) {
      console.error(`❌ Coin not found: ${symbol}`);
      return res.status(404).json({
        success: false,
        message: `Coin ${symbol} not found in database`,
      });
    }
    console.log(`✅ Coin found: ${coin.name} (ID: ${coin.id})`);

    console.log(`🔍 [STEP 2] Looking up timeframe: ${timeframe}`);
    const timeframeRecord = await prisma.timeframe.findUnique({
      where: { timeframe },
      select: { id: true },
    });

    if (!timeframeRecord) {
      console.error(`❌ Timeframe not found: ${timeframe}`);
      return res.status(404).json({
        success: false,
        message: `Timeframe ${timeframe} not found in database`,
      });
    }
    console.log(`✅ Timeframe found (ID: ${timeframeRecord.id})`);

    // Count available data points using coinId and timeframeId
    console.log(`🔍 [STEP 3] Counting indicators...`);
    console.log(`   coinId: ${coin.id}`);
    console.log(`   timeframeId: ${timeframeRecord.id}`);
    console.log(
      `   time range: ${new Date(FIXED_START_EPOCH).toISOString()} → ${new Date(FIXED_END_EPOCH).toISOString()}`
    );

    const dataCount = await prisma.indicator.count({
      where: {
        coinId: coin.id,
        timeframeId: timeframeRecord.id,
        time: {
          gte: BigInt(FIXED_START_EPOCH),
          lt: BigInt(FIXED_END_EPOCH),
        },
      },
    });

    console.log(`✅ Data count: ${dataCount} indicators found`);

    if (dataCount === 0) {
      console.warn(
        `⚠️ No data available for ${symbol} in specified time range`
      );
      return res.status(404).json({
        success: false,
        message: "No data available for optimization",
        details: {
          symbol,
          coinId: coin.id,
          timeframe,
          timeframeId: timeframeRecord.id,
          timeRange: {
            start: new Date(FIXED_START_EPOCH).toISOString(),
            end: new Date(FIXED_END_EPOCH).toISOString(),
          },
        },
      });
    }

    // 🎯 FORMULA ESTIMASI BERDASARKAN BENCHMARK REAL
    const BENCHMARK_DATA_POINTS = 45893;
    const BENCHMARK_MINUTES = 78;
    const totalCombinations = 390625; // 5^8

    // Linear scaling berdasarkan data points
    const estimatedMinutes = Math.ceil(
      (dataCount / BENCHMARK_DATA_POINTS) * BENCHMARK_MINUTES
    );
    const estimatedSeconds = estimatedMinutes * 60;

    // Range estimate (±15% karena variance algoritma)
    const minSeconds = Math.floor(estimatedSeconds * 0.85);
    const maxSeconds = Math.ceil(estimatedSeconds * 1.15);

    // Format waktu yang user-friendly
    const formatTime = (seconds) => {
      if (seconds < 60) return `${seconds} detik`;
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `${minutes} menit ${secs} detik` : `${minutes} menit`;
    };

    const estimate = {
      dataPoints: dataCount,
      totalCombinations,
      estimatedSeconds,
      estimatedMinutes,
      estimatedRange: {
        min: minSeconds,
        max: maxSeconds,
        minFormatted: formatTime(minSeconds),
        maxFormatted: formatTime(maxSeconds),
      },
      formatted: formatTime(estimatedSeconds),
      benchmarkInfo: {
        benchmarkDataPoints: BENCHMARK_DATA_POINTS,
        benchmarkMinutes: BENCHMARK_MINUTES,
        scalingFactor: (dataCount / BENCHMARK_DATA_POINTS).toFixed(2),
      },
      displayNote: `Testing ${totalCombinations.toLocaleString()} combinations on ${dataCount.toLocaleString()} candles`, // ✅ Clear message
    };

    console.log(
      `✅ Estimate: ${estimate.formatted} (${dataCount} data points)`
    );
    console.log(
      `   Scaling factor: ${estimate.benchmarkInfo.scalingFactor}x benchmark`
    );

    res.json({
      success: true,
      symbol,
      timeframe,
      estimate,
    });
  } catch (err) {
    console.error("❌ Error calculating estimate:", err.message);
    console.error("Stack trace:", err.stack);
    res.status(500).json({
      success: false,
      message: err.message,
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
}

/* --- Optimize --- */
export async function optimizeIndicatorWeightsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    // 🆕 Support force reoptimization
    const forceReoptimize =
      req.body.force === true || req.query.force === "true";

    console.log(
      `\n📊 Starting Full Exhaustive Search Optimization for ${symbol} (${timeframe})`
    );
    console.log(
      `   Training window: ${new Date(FIXED_START_EPOCH).toISOString()} → ${new Date(
        FIXED_END_EPOCH
      ).toISOString()} (FIXED)`
    );

    if (forceReoptimize) {
      console.log(
        `   🔄 FORCE REOPTIMIZATION MODE - Will override existing weights`
      );
    }

    const startQuery = Date.now();

    // 🔧 Get coinId and timeframeId first
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

    if (!coin) {
      return res.status(404).json({
        success: false,
        message: `Coin ${symbol} not found in database`,
      });
    }

    if (!timeframeRecord) {
      return res.status(404).json({
        success: false,
        message: `Timeframe ${timeframe} not found in database`,
      });
    }

    // Check if optimization already exists using coinId and timeframeId
    const existingWeight = await prisma.indicatorWeight.findFirst({
      where: {
        coinId: coin.id,
        timeframeId: timeframeRecord.id,
        startTrain: BigInt(FIXED_START_EPOCH),
        endTrain: BigInt(FIXED_END_EPOCH),
      },
      orderBy: { updatedAt: "desc" },
    });

    let performanceData, weightsData, lastOptimizedDate;

    // 🆕 Skip existing check if force reoptimize
    if (existingWeight && !forceReoptimize) {
      console.log(`⏩ Optimization already exists for ${symbol}`);
      console.log(
        `   ROI: ${existingWeight.roi.toFixed(2)}%, WinRate: ${existingWeight.winRate.toFixed(2)}%`
      );

      performanceData = {
        roi: existingWeight.roi,
        winRate: existingWeight.winRate,
        maxDrawdown: existingWeight.maxDrawdown,
        sharpeRatio: existingWeight.sharpeRatio,
        trades: existingWeight.trades,
        initialCapital: 10000,
        finalCapital: existingWeight.finalCapital,
      };
      weightsData = existingWeight.weights;
      lastOptimizedDate = existingWeight.updatedAt;
    } else {
      // Run optimization (either no existing data OR force reoptimize)
      if (forceReoptimize && existingWeight) {
        console.log(`🔄 Forcing reoptimization despite existing weights...`);
      }

      // Fetch data within fixed window using coinId and timeframeId
      const [indicators, candles] = await Promise.all([
        prisma.indicator.findMany({
          where: {
            coinId: coin.id,
            timeframeId: timeframeRecord.id,
            time: {
              gte: BigInt(FIXED_START_EPOCH),
              lt: BigInt(FIXED_END_EPOCH),
            },
          },
          orderBy: { time: "asc" },
        }),
        prisma.candle.findMany({
          where: {
            coinId: coin.id,
            timeframeId: timeframeRecord.id,
            time: {
              gte: BigInt(FIXED_START_EPOCH),
              lt: BigInt(FIXED_END_EPOCH),
            },
          },
          orderBy: { time: "asc" },
          select: { time: true, close: true },
        }),
      ]);

      const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
      const data = indicators
        .filter((i) => map.has(i.time.toString()))
        .map((i) => ({ ...i, close: map.get(i.time.toString()) }));

      if (!data.length)
        return res.status(400).json({
          success: false,
          message: "Data kosong atau tidak cukup untuk optimasi",
        });

      if (data.length < 100) {
        return res.status(400).json({
          success: false,
          message: `Data tidak cukup untuk optimasi (${data.length}/100 minimum)`,
        });
      }

      // Format tanggal
      const formatDate = (t) =>
        new Intl.DateTimeFormat("id-ID", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "Asia/Jakarta",
        }).format(new Date(Number(t)));

      const range = {
        start: formatDate(data[0]?.time),
        end: formatDate(data[data.length - 1]?.time),
      };

      console.log(`Dataset: ${data.length} merged data points`);
      console.log(`Range: ${range.start} → ${range.end}`);

      // 🆕 Initialize progress state BEFORE optimization starts
      const progressState = {
        symbol,
        status: "running",
        progress: {
          tested: 0,
          total: 390625,
          percentage: 0,
          bestROI: 0,
          eta: "Calculating...",
        },
        startedAt: new Date().toISOString(),
        sseClients: new Set(),
      };

      // Get existing state to preserve SSE clients
      const existingState = optimizationJobs.get(symbol);
      if (existingState?.sseClients) {
        progressState.sseClients = existingState.sseClients;
      }

      optimizationJobs.set(symbol, progressState);
      console.log(`✅ [SSE] Progress state initialized for ${symbol}`);

      // Broadcast to all SSE clients
      const broadcastProgress = (eventName, data) => {
        const job = optimizationJobs.get(symbol);
        if (job?.sseClients) {
          console.log(
            `📡 [SSE-BROADCAST] Event: ${eventName} | Clients: ${job.sseClients.size}`
          );
          console.log(
            `📡 [SSE-BROADCAST] Data:`,
            JSON.stringify(data).substring(0, 200)
          );

          let successCount = 0;
          let failCount = 0;

          job.sseClients.forEach((client) => {
            try {
              const defaultPayload = JSON.stringify({
                type: eventName,
                ...data,
              });
              client.write(`data: ${defaultPayload}\n\n`);

              // ✅ CRITICAL: Force immediate transmission using socket
              if (client.socket && !client.socket.destroyed) {
                client.socket.uncork?.();
              }

              successCount++;
            } catch (err) {
              console.error(`  ❌ Error broadcasting to client:`, err.message);
              job.sseClients.delete(client);
              failCount++;
            }
          });

          console.log(
            `📡 [SSE-BROADCAST] Result: ${successCount} success, ${failCount} failed\n`
          );
        } else {
          console.warn(`⚠️ [SSE-BROADCAST] No clients connected for ${symbol}`);
        }
      };

      // ✅ IMMEDIATELY send start event BEFORE optimization begins
      console.log(`📡 [SSE] Broadcasting START event for ${symbol}...`);
      broadcastProgress("start", {
        symbol,
        dataPoints: data.length,
        totalCombinations: 390625,
        datasetRange: {
          start: new Date(Number(data[0].time)).toISOString(),
          end: new Date(Number(data[data.length - 1].time)).toISOString(),
        },
      });

      // 🆕 Progress callback with SSE broadcasting
      const onProgress = (progressData) => {
        const currentState = optimizationJobs.get(symbol);

        // ✅ CRITICAL: Check if cancelled BEFORE broadcasting progress
        if (
          !currentState ||
          currentState.cancelRequested === true ||
          currentState.status === "cancelled"
        ) {
          console.log(
            `🛑 [${symbol}] Skipping progress broadcast - optimization is cancelled`
          );
          return; // Don't broadcast if cancelled
        }

        if (currentState) {
          currentState.progress = progressData;
          currentState.status = "running";
          optimizationJobs.set(symbol, currentState);

          // Broadcast to SSE clients
          broadcastProgress("progress", progressData);

          // Log only every 10,000 combinations for cleaner console
          if (
            progressData.tested % 10000 === 0 ||
            progressData.tested === progressData.total
          ) {
            console.log(
              `📊 [${symbol}] ${progressData.tested}/${progressData.total} (${progressData.percentage}%) | Best: ${progressData.bestROI}% | ETA: ${progressData.eta}`
            );
          }
        }
      };

      // ✅ NEW: Cancel checker function
      const checkCancel = () => {
        const currentState = optimizationJobs.get(symbol);
        return currentState?.cancelRequested === true;
      };

      try {
        console.log(`🚀 Starting optimization for ${symbol}...`);
        const result = await optimizeIndicatorWeights(
          data,
          symbol,
          onProgress,
          checkCancel
        ); // ✅ Pass checkCancel

        // ✅ Handle cancellation response
        if (result.cancelled) {
          console.log(`🛑 Optimization was cancelled for ${symbol}`);

          const cancelState = optimizationJobs.get(symbol);
          if (cancelState) {
            cancelState.status = "cancelled";
            optimizationJobs.set(symbol, cancelState);
          }

          // Already broadcasted by cancelOptimizationController
          // Just clean up
          setTimeout(() => {
            optimizationJobs.delete(symbol);
            console.log(`🧹 Cleaned up cancelled optimization for ${symbol}`);
          }, 60 * 1000);

          return; // Don't continue processing
        }

        // Mark as completed
        const finalState = optimizationJobs.get(symbol);
        if (finalState) {
          finalState.status = "completed";
          finalState.result = result;
          finalState.completedAt = new Date().toISOString();
          optimizationJobs.set(symbol, finalState);

          // Broadcast completion to SSE clients
          broadcastProgress("completed", {
            success: true,
            performance: result.performance,
            weights: result.bestWeights,
            executionTime: result.executionTimeSeconds,
          });

          console.log(`✅ [SSE] Optimization completed for ${symbol}`);

          // Close all SSE connections
          setTimeout(() => {
            if (finalState.sseClients) {
              finalState.sseClients.forEach((client) => {
                try {
                  client.end();
                } catch (err) {
                  // Ignore errors when closing
                }
              });
            }
          }, 1000);
        }

        // Save to database with coinId and timeframeId
        await prisma.indicatorWeight.upsert({
          where: {
            coinId_timeframeId_startTrain_endTrain: {
              coinId: coin.id,
              timeframeId: timeframeRecord.id,
              startTrain: BigInt(FIXED_START_EPOCH),
              endTrain: BigInt(FIXED_END_EPOCH),
            },
          },
          update: {
            weights: result.bestWeights,
            roi: result.performance.roi,
            winRate: result.performance.winRate,
            maxDrawdown: result.performance.maxDrawdown,
            sharpeRatio: result.performance.sharpeRatio,
            trades: result.performance.trades,
            finalCapital: result.performance.finalCapital,
            candleCount: data.length,
          },
          create: {
            coinId: coin.id,
            timeframeId: timeframeRecord.id,
            startTrain: BigInt(FIXED_START_EPOCH),
            endTrain: BigInt(FIXED_END_EPOCH),
            weights: result.bestWeights,
            roi: result.performance.roi,
            winRate: result.performance.winRate,
            maxDrawdown: result.performance.maxDrawdown,
            sharpeRatio: result.performance.sharpeRatio,
            trades: result.performance.trades,
            finalCapital: result.performance.finalCapital,
            candleCount: data.length,
          },
        });

        const totalProcessingTime = `${((Date.now() - startQuery) / 1000).toFixed(2)}s`;

        console.log(`Optimization saved to database`);
        console.log(`Total processing time: ${totalProcessingTime}`);

        performanceData = {
          roi: result.performance.roi,
          winRate: result.performance.winRate,
          maxDrawdown: result.performance.maxDrawdown,
          sharpeRatio: result.performance.sharpeRatio,
          trades: result.performance.trades,
          initialCapital: 10000,
          finalCapital: result.performance.finalCapital,
        };
        weightsData = result.bestWeights;
        lastOptimizedDate = new Date().toISOString();

        // Clean up after 5 minutes
        setTimeout(
          () => {
            optimizationJobs.delete(symbol);
            console.log(`🧹 Cleaned up progress state for ${symbol}`);
          },
          5 * 60 * 1000
        );
      } catch (optimizationError) {
        console.error(
          `❌ Optimization error for ${symbol}:`,
          optimizationError
        );

        const errorState = optimizationJobs.get(symbol);
        if (errorState) {
          errorState.status = "error";
          errorState.error = optimizationError.message;
          optimizationJobs.set(symbol, errorState);

          // Broadcast error to SSE clients
          broadcastProgress("error", {
            message: optimizationError.message,
          });

          // Close SSE connections
          if (errorState.sseClients) {
            errorState.sseClients.forEach((client) => {
              try {
                client.end();
              } catch (err) {
                // Ignore
              }
            });
          }
        }

        // Clean up after 1 minute on error
        setTimeout(() => {
          optimizationJobs.delete(symbol);
        }, 60 * 1000);

        throw optimizationError;
      }
    }

    // Fetch LATEST candle and indicator data using coinId and timeframeId
    console.log(`Fetching latest candle and indicators for ${symbol}...`);

    const [latestCandle, latestIndicator] = await Promise.all([
      prisma.candle.findFirst({
        where: { coinId: coin.id, timeframeId: timeframeRecord.id },
        orderBy: { time: "desc" },
        select: {
          time: true,
          open: true,
          high: true,
          low: true,
          close: true,
          volume: true,
        },
      }),
      prisma.indicator.findFirst({
        where: { coinId: coin.id, timeframeId: timeframeRecord.id },
        orderBy: { time: "desc" },
      }),
    ]);

    if (!latestCandle || !latestIndicator) {
      return res.status(404).json({
        success: false,
        message: "No latest candle or indicator data found",
      });
    }

    // Build latest data structure (same format as /api/chart)
    const latestData = {
      time: Number(latestCandle.time),
      open: latestCandle.open,
      high: latestCandle.high,
      low: latestCandle.low,
      close: latestCandle.close,
      volume: latestCandle.volume,

      // Multi-indicator signal
      multiSignal: {
        signal: latestIndicator.overallSignal?.toLowerCase() || "neutral",
        strength: latestIndicator.signalStrength || 0,
        normalized: latestIndicator.normalizedSignal || 0,
        rawSignal: latestIndicator.rawSignal?.toLowerCase() || "neutral",
        source: "db",
      },

      // All indicators (same structure as chart endpoint)
      indicators: {
        sma: {
          20: latestIndicator.sma20,
          50: latestIndicator.sma50,
          signal: latestIndicator.smaSignal,
        },
        ema: {
          20: latestIndicator.ema20,
          50: latestIndicator.ema50,
          signal: latestIndicator.emaSignal,
        },
        rsi: {
          14: latestIndicator.rsi,
          signal: latestIndicator.rsiSignal,
        },
        macd: {
          macd: latestIndicator.macd,
          signalLine: latestIndicator.macdSignal,
          histogram: latestIndicator.macdHistogram,
          signal: latestIndicator.macdSignal,
        },
        bollingerBands: {
          upper: latestIndicator.bbUpper,
          middle: latestIndicator.bbMiddle,
          lower: latestIndicator.bbLower,
          signal: latestIndicator.bbSignal,
        },
        stochastic: {
          "%K": latestIndicator.stochK,
          "%D": latestIndicator.stochD,
          signal: latestIndicator.stochSignal,
        },
        stochasticRsi: {
          "%K": latestIndicator.stochRsiK,
          "%D": latestIndicator.stochRsiD,
          signal: latestIndicator.stochRsiSignal,
        },
        parabolicSar: {
          value: latestIndicator.psar,
          signal: latestIndicator.psarSignal,
        },
      },
    };

    // 🎯 Calculate Category Scores from backend
    const categoryScores = calculateCategoryScores(
      latestData.indicators,
      weightsData
    );

    console.log(`Latest data fetched successfully`);
    console.log(`Time: ${new Date(latestData.time).toISOString()}`);
    console.log(`Price: ${latestData.close}`);
    console.log(`Multi Signal: ${latestData.multiSignal.signal}`);
    console.log(`Category Scores:`, categoryScores);

    // Return response with latest data + categoryScores
    res.json({
      success: true,
      symbol,
      timeframe,
      lastOptimized: lastOptimizedDate,
      performance: performanceData,
      weights: weightsData,
      categoryScores,
      latest: latestData,
    });
  } catch (err) {
    console.error("❌ Error in optimization:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
}

/* --- Optimize All --- */
export async function optimizeAllCoinsController(req, res) {
  try {
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    console.log(`\n🚀 Starting mass optimization for 20 top coins...`);
    console.log(
      `   Training window: DYNAMIC (based on data availability per coin)\n`
    );

    // Konstanta untuk training window
    const FIXED_START = BigInt(FIXED_START_EPOCH);
    const FIXED_END = BigInt(FIXED_END_EPOCH);

    // Ambil 20 coin teratas
    const coins = await prisma.coin.findMany({
      orderBy: { rank: "asc" },
      take: 20,
      select: { symbol: true },
    });

    if (!coins.length) {
      return res.status(404).json({
        success: false,
        message: "Tidak ada data coin di tabel Coin.",
      });
    }

    const results = [];
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // Proses setiap coin secara sequential
    for (const [index, coin] of coins.entries()) {
      const symbol = coin.symbol.toUpperCase();
      const progress = `[${index + 1}/${coins.length}]`;

      try {
        console.log(`${progress} 📊 Optimizing ${symbol}...`);

        // Ambil candle tertua dan terbaru untuk symbol ini
        const [earliestCandle, latestCandle] = await Promise.all([
          prisma.candle.findFirst({
            where: { symbol, timeframe },
            orderBy: { time: "asc" },
            select: { time: true },
          }),
          prisma.candle.findFirst({
            where: { symbol, timeframe },
            orderBy: { time: "desc" },
            select: { time: true },
          }),
        ]);

        // Validasi data candle
        if (!earliestCandle || !latestCandle) {
          console.warn(`${progress} ⚠️ No candle data for ${symbol}`);
          results.push({
            symbol,
            success: false,
            message: "No candle data",
          });
          failedCount++;
          continue;
        }

        // Tentukan training window secara dinamis
        let realStartEpoch, realEndEpoch;

        if (earliestCandle.time < FIXED_END) {
          // Data dimulai sebelum 2025-11-01 → gunakan window skripsi
          realStartEpoch = FIXED_START;
          realEndEpoch = FIXED_END;
        } else {
          // Data dimulai setelah 2025-01-01 → gunakan semua data tersedia
          realStartEpoch = earliestCandle.time;
          realEndEpoch = latestCandle.time;
        }

        console.log(
          `${progress} Training window used: ${new Date(Number(realStartEpoch)).toISOString()} → ${new Date(Number(realEndEpoch)).toISOString()}`
        );

        // Fetch data dengan dynamic window
        const [indicators, candles] = await Promise.all([
          prisma.indicator.findMany({
            where: {
              symbol,
              timeframe,
              time: {
                gte: realStartEpoch,
                lt: realEndEpoch,
              },
            },
            orderBy: { time: "asc" },
          }),
          prisma.candle.findMany({
            where: {
              symbol,
              timeframe,
              time: {
                gte: realStartEpoch,
                lt: realEndEpoch,
              },
            },
            orderBy: { time: "asc" },
            select: { time: true, close: true },
          }),
        ]);

        // Gabungkan indikator + harga
        const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
        const data = indicators
          .filter((i) => map.has(i.time.toString()))
          .map((i) => ({ ...i, close: map.get(i.time.toString()) }));

        // Validasi data gabungan
        if (!data.length || data.length < 100) {
          console.warn(
            `${progress} ⚠️ Insufficient data for ${symbol} (${data.length}/100 minimum)`
          );
          results.push({
            symbol,
            success: false,
            message: `Insufficient data (${data.length}/100 minimum)`,
          });
          failedCount++;
          continue;
        }

        // CEK apakah sudah ada optimasi sebelumnya dengan range yang sama - ✅ Use latest
        const existingWeight = await prisma.indicatorWeight.findFirst({
          where: {
            symbol,
            timeframe,
            startTrain: realStartEpoch,
            endTrain: realEndEpoch,
          },
          orderBy: { updatedAt: "desc" }, // ✅ Always use the latest optimization
        });

        // Format tanggal untuk response
        const formatDate = (t) =>
          new Intl.DateTimeFormat("id-ID", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "Asia/Jakarta",
          }).format(new Date(Number(t)));

        // Jika sudah ada, skip optimasi
        if (existingWeight) {
          console.log(
            `${progress} ⏭️ ${symbol} already optimized, skipping...`
          );
          console.log(
            `   ROI: ${existingWeight.roi.toFixed(2)}% | WinRate: ${existingWeight.winRate.toFixed(2)}% | MDD: ${existingWeight.maxDrawdown.toFixed(2)}%`
          );

          results.push({
            symbol,
            success: true,
            skipped: true,
            timeframe,
            dataPoints: data.length,
            trainingWindow: {
              start: new Date(Number(realStartEpoch)).toISOString(),
              end: new Date(Number(realEndEpoch)).toISOString(),
            },
            range: {
              start: formatDate(data[0].time),
              end: formatDate(data[data.length - 1].time),
            },
            performance: {
              roi: existingWeight.roi,
              winRate: existingWeight.winRate,
              maxDrawdown: existingWeight.maxDrawdown,
              sharpeRatio: existingWeight.sharpeRatio,
              trades: existingWeight.trades,
              finalCapital: existingWeight.finalCapital,
            },
            weights: existingWeight.weights,
            lastOptimized: existingWeight.updatedAt,
          });

          skippedCount++;
          continue;
        }

        // Jalankan optimasi HANYA jika belum ada
        console.log(`${progress} 🔍 Starting optimization for ${symbol}...`);
        const result = await optimizeIndicatorWeights(data, symbol);

        // Simpan ke database dengan dynamic epochs
        await prisma.indicatorWeight.create({
          data: {
            symbol,
            timeframe,
            startTrain: realStartEpoch,
            endTrain: realEndEpoch,
            weights: result.bestWeights,
            roi: result.performance.roi,
            winRate: result.performance.winRate,
            maxDrawdown: result.performance.maxDrawdown,
            sharpeRatio: result.performance.sharpeRatio,
            trades: result.performance.trades,
            finalCapital: result.performance.finalCapital,
            candleCount: data.length,
          },
        });

        // Tambahkan ke hasil
        results.push({
          symbol,
          success: true,
          skipped: false,
          timeframe,
          dataPoints: data.length,
          trainingWindow: {
            start: new Date(Number(realStartEpoch)).toISOString(),
            end: new Date(Number(realEndEpoch)).toISOString(),
          },
          range: {
            start: formatDate(data[0].time),
            end: formatDate(data[data.length - 1]?.time),
          },
          performance: {
            roi: result.performance.roi,
            winRate: result.performance.winRate,
            maxDrawdown: result.performance.maxDrawdown,
            sharpeRatio: result.performance.sharpeRatio,
            trades: result.performance.trades,
            finalCapital: result.performance.finalCapital,
          },
          weights: result.bestWeights,
          optimizationTimeSeconds: result.executionTimeSeconds,
        });

        successCount++;
        console.log(
          `${progress} ✅ ${symbol} created → ROI: ${result.performance.roi.toFixed(2)}% | WinRate: ${result.performance.winRate.toFixed(2)}% | MDD: ${result.performance.maxDrawdown.toFixed(2)}%`
        );
      } catch (err) {
        console.error(
          `${progress} ❌ Error optimizing ${symbol}:`,
          err.message
        );
        results.push({
          symbol,
          success: false,
          message: err.message,
        });
        failedCount++;
      }
    }

    const summaryMessage = `Optimasi selesai (${successCount} berhasil / ${skippedCount} di-skip / ${failedCount} gagal)`;

    console.log(`\n✅ ${summaryMessage}`);

    res.json({
      success: true,
      message: summaryMessage,
      count: coins.length,
      successCount,
      skippedCount,
      failedCount,
      results,
    });
  } catch (err) {
    console.error("❌ Error optimizeAllCoins:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
}

/* --- Backtest --- */
export async function backtestWithOptimizedWeightsController(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = (req.query.timeframe || "1h").toLowerCase();

    console.log(
      `\n📊 Starting optimized-weight backtest for ${symbol} (${timeframe})`
    );

    // Find weight dengan FIXED window
    const latest = await prisma.indicatorWeight.findFirst({
      where: {
        symbol,
        timeframe,
        startTrain: BigInt(FIXED_START_EPOCH),
        endTrain: BigInt(FIXED_END_EPOCH),
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!latest)
      return res.status(404).json({
        success: false,
        message: "No optimized weights found. Please run optimization first.",
      });

    const startQuery = Date.now();

    const [indicators, candles] = await Promise.all([
      prisma.indicator.findMany({
        where: {
          symbol,
          timeframe,
          time: { gte: BigInt(FIXED_START_EPOCH), lt: BigInt(FIXED_END_EPOCH) },
        },
        orderBy: { time: "asc" },
      }),
      prisma.candle.findMany({
        where: {
          symbol,
          timeframe,
          time: { gte: BigInt(FIXED_START_EPOCH), lt: BigInt(FIXED_END_EPOCH) },
        },
        orderBy: { time: "asc" },
        select: { time: true, close: true },
      }),
    ]);

    const map = new Map(candles.map((c) => [c.time.toString(), c.close]));
    const data = indicators
      .filter((i) => map.has(i.time.toString()))
      .map((i) => ({ ...i, close: map.get(i.time.toString()) }));

    if (!data.length)
      return res.status(400).json({
        success: false,
        message: "Data tidak ditemukan",
      });

    // Format tanggal
    const formatDate = (t) =>
      new Intl.DateTimeFormat("id-ID", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(new Date(Number(t)));

    const range = {
      start: formatDate(data[0]?.time),
      end: formatDate(data[data.length - 1]?.time),
    };

    const dataset = {
      candleStart: formatDate(candles[0]?.time),
      indicatorStart: formatDate(indicators[0]?.time),
      candleCount: candles.length,
      indicatorCount: indicators.length,
    };

    console.log(`   Total data points: ${data.length}`);
    console.log(`   Range: ${range.start} - ${range.end}`);
    console.log(`   Using optimized weights:`, latest.weights);

    const result = await backtestWithWeights(data, latest.weights);
    const processingTime = `${((Date.now() - startQuery) / 1000).toFixed(2)}s`;

    console.log(`✅ Optimized-weight backtest completed in ${processingTime}`);
    console.log(
      `   ROI: ${result.roi}%, Win Rate: ${result.winRate}%, Trades: ${result.trades}`
    );

    res.json({
      success: true,
      symbol,
      timeframe,
      totalData: data.length,
      range,
      dataset,
      processingTime,
      timestamp: new Date().toISOString(),
      methodology: "Optimized-Weight Multi-Indicator Backtest",
      weights: latest.weights,
      performance: {
        roi: result.roi,
        winRate: result.winRate,
        maxDrawdown: result.maxDrawdown,
        sharpeRatio: result.sharpeRatio || null,
        trades: result.trades,
        finalCapital: result.finalCapital,
      },
    });
  } catch (err) {
    console.error("❌ Error in optimized-weight backtest:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
}
