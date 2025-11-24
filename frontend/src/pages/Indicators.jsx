import { useIndicator } from "../hooks/useIndicators";
import { useSymbol } from "../contexts/SymbolContext";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useMemo } from "react";

// Import components
import SignalsHeader from "../components/signals/SignalsHeader";
import CategorySummaryCard from "../components/signals/CategorySummaryCard";
import BacktestPanel from "../components/signals/BacktestPanel";
import IndicatorTable from "../components/signals/IndicatorTable";
import MultiIndicatorPanel from "../components/signals/MultiIndicatorPanel";

// Import utils
import {
  parseIndicators,
  parseIndicatorsDetailed,
  normalizeIndicatorName,
} from "../utils/indicatorParser";

function Signals() {
  const { selectedSymbol } = useSymbol();
  const { isDarkMode } = useDarkMode();

  // 🔥 SINGLE UNIFIED ENDPOINT - mode=latest
  const {
    data: indicatorData,
    isLoading,
    error,
  } = useIndicator(selectedSymbol, "latest", "1h");

  // Debug: Log data
  console.log("📊 Unified Indicator Data:", indicatorData);

  // 🎯 Parse and extract data from latestSignal ONLY
  const {
    parsedIndicators,
    parsedIndicatorsDetailed,
    categoryScores,
    multiSignal,
    signalStrength,
    latestPrice,
    latestTime,
    weights,
    performance,
    timeframe,
  } = useMemo(() => {
    // 🔥 USE ONLY latestSignal from unified API
    const latestSignal = indicatorData?.latestSignal;

    // Early return if no data
    if (!latestSignal) {
      console.warn("⚠️ No latestSignal available");
      return {
        parsedIndicators: { trend: [], momentum: [], volatility: [] },
        parsedIndicatorsDetailed: { trend: [], momentum: [], volatility: [] },
        categoryScores: { trend: 0, momentum: 0, volatility: 0 },
        multiSignal: "neutral",
        signalStrength: 0,
        latestPrice: null,
        latestTime: null,
        weights: {},
        performance: null,
        timeframe: "1h",
      };
    }

    // 📦 Extract all data from latestSignal
    const {
      indicators,
      categoryScores: scores,
      weights: weightsData,
      performance: performanceData,
      multiSignal: signal,
      price,
      time,
    } = latestSignal;

    // 🎯 Safely extract signal and strength
    const normalizedSignal = signal?.signal || "neutral";
    const strength = signal?.normalized || signal?.strength || 0;

    console.log("🎯 Multi Signal:", normalizedSignal);
    console.log("📊 Signal Strength:", strength);
    console.log("📈 Category Scores:", scores);

    // Parse indicators for cards (simplified - 8 core indicators)
    const parsed = parseIndicators(indicators, price, weightsData || {});

    // Parse detailed indicators for table (with periods like SMA 20, SMA 50)
    const detailedParsed = parseIndicatorsDetailed(
      indicators,
      price,
      weightsData || {}
    );

    return {
      parsedIndicators: parsed,
      parsedIndicatorsDetailed: detailedParsed,
      categoryScores: scores || { trend: 0, momentum: 0, volatility: 0 },
      multiSignal: normalizedSignal,
      signalStrength: strength,
      latestPrice: price,
      latestTime: time,
      weights: weightsData || {},
      performance: performanceData,
      timeframe: indicatorData?.timeframe || "1h",
    };
  }, [indicatorData]);

  // Determine active categories based on weights
  const activeCategories = useMemo(() => {
    const w = weights || {};
    return {
      trend: (w.SMA || 0) + (w.EMA || 0) + (w.PSAR || 0) > 0,
      momentum:
        (w.RSI || 0) +
          (w.MACD || 0) +
          (w.Stochastic || 0) +
          (w.StochasticRSI || 0) >
        0,
      volatility: (w.BollingerBands || 0) > 0,
    };
  }, [weights]);

  // Generate best combo string from active weights
  const bestCombo = useMemo(() => {
    const activeCombos = [];
    if (activeCategories.trend) activeCombos.push("Trend");
    if (activeCategories.momentum) activeCombos.push("Momentum");
    if (activeCategories.volatility) activeCombos.push("Volatility");
    return activeCombos.length > 0
      ? activeCombos.join(" + ")
      : "No Active Strategy";
  }, [activeCategories]);

  // Format last update time
  const lastUpdate = latestTime
    ? new Date(latestTime).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "N/A";

  // 🔄 Loading State
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div className={isDarkMode ? "text-gray-400" : "text-gray-500"}>
            Loading signals...
          </div>
        </div>
      </div>
    );
  }

  // ❌ Error State
  if (error) {
    return (
      <div
        className={`p-4 border rounded-lg ${
          isDarkMode
            ? "bg-red-900 border-red-600 text-red-300"
            : "bg-red-100 border-red-400 text-red-700"
        }`}
      >
        <p className="font-semibold">Error loading signals</p>
        <p className="text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  // All indicators for table (using detailed parse)
  const allIndicatorsRaw = [
    ...parsedIndicatorsDetailed.trend.map((ind) => ({
      ...ind,
      category: "Trend",
    })),
    ...parsedIndicatorsDetailed.momentum.map((ind) => ({
      ...ind,
      category: "Momentum",
    })),
    ...parsedIndicatorsDetailed.volatility.map((ind) => ({
      ...ind,
      category: "Volatility",
    })),
  ];

  // Normalize indicator names for cleaner display
  const allIndicators = normalizeIndicatorName(allIndicatorsRaw);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <SignalsHeader
        selectedSymbol={selectedSymbol}
        methodology="Weighted Multi-Indicator Strategy"
        lastUpdate={lastUpdate}
        price={latestPrice}
        timeframe={timeframe}
        bestCombo={bestCombo}
        isDarkMode={isDarkMode}
      />

      {/* Category Summary Cards - 3 Categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CategorySummaryCard
          title="Trend Indicators"
          indicators={parsedIndicators.trend}
          color={
            isDarkMode
              ? "bg-blue-900 text-blue-300"
              : "bg-blue-100 text-blue-700"
          }
          isDarkMode={isDarkMode}
          icon="📈"
        />
        <CategorySummaryCard
          title="Momentum Indicators"
          indicators={parsedIndicators.momentum}
          color={
            isDarkMode
              ? "bg-purple-900 text-purple-300"
              : "bg-purple-100 text-purple-700"
          }
          isDarkMode={isDarkMode}
          icon="⚡"
        />
        <CategorySummaryCard
          title="Volatility Indicators"
          indicators={parsedIndicators.volatility}
          color={
            isDarkMode
              ? "bg-green-900 text-green-300"
              : "bg-green-100 text-green-700"
          }
          isDarkMode={isDarkMode}
          icon="💥"
        />
      </div>

      {/* Backtest Performance Panel */}
      <BacktestPanel
        performance={performance}
        bestCombo={bestCombo}
        isDarkMode={isDarkMode}
      />

      {/* Bottom Section: Indicator Table & Multi Indicator Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <IndicatorTable allIndicators={allIndicators} isDarkMode={isDarkMode} />
        <MultiIndicatorPanel
          multiSignal={multiSignal.toUpperCase()}
          totalScore={signalStrength}
          categoryScores={categoryScores}
          activeCategories={activeCategories}
          parsedIndicators={parsedIndicators}
          isDarkMode={isDarkMode}
        />
      </div>
    </div>
  );
}

export default Signals;
