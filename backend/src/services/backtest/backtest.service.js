import { validateAndFillRsiData } from "./backtest.utils.js";
import { makeSignalFuncs, runBacktestCore } from "./backtest.core.js";

export async function backtestSingleIndicator(data, indicatorName) {
  if (!data?.length) throw new Error("Data historis diperlukan.");
  data = validateAndFillRsiData(data);

  // 🔍 Debug: cek sample data
  const sample = data[Math.floor(data.length / 2)];
  console.log(`\n🔍 Backtesting ${indicatorName}...`);
  console.log(`   Total data points: ${data.length}`);
  console.log(`   Period: Full dataset (no train/test split)`);
  console.log(`   Sample indicator values:`, {
    close: sample.close,
    rsi: sample.rsi,
    macd: sample.macd,
    sma20: sample.sma20,
    ema20: sample.ema20,
    bbUpper: sample.bbUpper,
    stochK: sample.stochK,
    psar: sample.psar,
  });

  // Gunakan FULL dataset tanpa split
  // Recompute signals on-the-fly (useStoredSignals = false)
  const funcs = makeSignalFuncs();
  const performance = runBacktestCore(data, indicatorName, funcs, false);

  return {
    success: true,
    indicator: indicatorName,
    performance,
  };
}

/**
 * 🚀 Backtest semua indikator utama
 *
 * Menjalankan backtest untuk semua 8 indikator teknikal menggunakan FULL dataset.
 * Signals selalu dihitung ulang (rule-based) untuk validasi akademis yang konsisten.
 * Tidak ada train/test split - semua data digunakan untuk backtest.
 */
export async function backtestAllIndicators(data) {
  const list = [
    "RSI",
    "MACD",
    "SMA",
    "EMA",
    "BollingerBands",
    "Stochastic",
    "StochasticRSI",
    "PSAR",
  ];
  const results = [];

  console.log(
    `\n🚀 Running ${list.length} indicator backtests (rule-based, full dataset)...`
  );
  console.log(`📊 Total historical data: ${data.length} candles`);
  console.log(`📅 Period: 2020-01-01 to 2025-01-01 (no train/test split)\n`);

  for (const name of list) {
    try {
      const result = await backtestSingleIndicator(data, name);
      results.push(result);
    } catch (err) {
      console.error(`❌ ${name} error:`, err.message);
      results.push({
        success: false,
        indicator: name,
        performance: {
          roi: 0,
          winRate: 0,
          maxDrawdown: 0,
          trades: 0,
          wins: 0,
          finalCapital: 10000,
        },
        error: err.message,
      });
    }
  }

  // 📊 Display summary table
  console.log("\n📊 BACKTEST RESULTS SUMMARY (FULL PERIOD 2020-2025):");
  console.table(
    results.map((r) => ({
      Indicator: r.indicator,
      "ROI %": r.performance.roi,
      "Win Rate %": r.performance.winRate.toFixed(2),
      "Max DD %": r.performance.maxDrawdown,
      "Total Trades": r.performance.trades,
      "Winning Trades": r.performance.wins,
      "Final Capital": `$${r.performance.finalCapital.toFixed(2)}`,
      "Sharpe Ratio": r.performance.sharpeRatio || "N/A",
      "Sortino Ratio": r.performance.sortinoRatio || "N/A",
    }))
  );

  return { success: true, total: results.length, results };
}
