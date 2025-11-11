import { backtestWithWeights } from "./multiIndicator-backtest.service.js";
import crypto from "crypto";

function coinSeed(symbol) {
  const hash = crypto.createHash("md5").update(symbol).digest("hex");
  return parseInt(hash.slice(0, 8), 16);
}

function seededRandom(seedObj) {
  let x = Math.sin(seedObj.value++) * 390625;
  return x - Math.floor(x);
}

export async function optimizeIndicatorWeights(data, symbol = "BTC-USD") {
  const weightRange = [0, 1, 2, 3, 4];
  const allIndicators = [
    "SMA",
    "EMA",
    "PSAR",
    "RSI",
    "MACD",
    "Stochastic",
    "StochasticRSI",
    "BollingerBands",
  ];

  const results = [];
  const totalCombos = 1000;
  const seedObj = { value: coinSeed(symbol) };

  for (let i = 0; i < totalCombos; i++) {
    const weights = Object.fromEntries(
      allIndicators.map((k) => [
        k,
        weightRange[Math.floor(seededRandom(seedObj) * weightRange.length)],
      ])
    );

    const result = await backtestWithWeights(data, weights, {
      fastMode: true,
    });
    results.push({ weights, ...result });

    if (i % 1000 === 0 && i > 0) {
      const bestSoFar = results.reduce((a, b) => (b.roi > a.roi ? b : a));
      console.log(
        `   Progress: ${i}/${totalCombos} (${((i / totalCombos) * 100).toFixed(1)}%) | Best ROI so far: ${bestSoFar.roi}%`
      );
    }
  }

  // Cari kombinasi terbaik berdasarkan ROI
  const best = results.reduce((a, b) => (b.roi > a.roi ? b : a));

  return {
    success: true,
    methodology:
      "Deterministic Random-Search Multi-Indicator Optimization (Full Dataset)",
    bestWeights: best.weights,
    performance: {
      roi: best.roi,
      winRate: best.winRate,
      maxDrawdown: best.maxDrawdown,
      trades: best.trades,
      wins: best.wins,
      finalCapital: best.finalCapital,
      sharpeRatio: best.sharpeRatio || null,
      sortinoRatio: best.sortinoRatio || null,
    },
    totalCombinationsTested: totalCombos,
    dataPoints: data.length,
  };
}
