/**
 * Indicators Page Module - Refactored for new API structure
 */
import { ApiService } from "../services/api.service.js";

export class IndicatorsPage {
  constructor() {
    this.apiService = new ApiService();
    this.isActive = false;
    this.refreshInterval = null;
  }

  async initialize() {
    console.log("🧮 Initializing Technical Indicators page...");
    this.isActive = true;

    // Setup refresh button
    const refreshBtn = document.getElementById("refresh-indicators");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        await this.loadAllIndicatorData();
      });
    }

    // Load initial data
    await this.loadAllIndicatorData();
  }

  destroy() {
    console.log("🧹 Destroying Indicators page...");
    this.isActive = false;
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  async loadAllIndicatorData() {
    const refreshBtn = document.getElementById("refresh-indicators");
    const refreshText = document.getElementById("refresh-btn-text");

    try {
      // Show loading state
      if (refreshBtn) refreshBtn.disabled = true;
      if (refreshText) refreshText.textContent = "Refreshing...";

      // Fetch both indicator types in parallel
      const [indicatorData, multiData] = await Promise.allSettled([
        this.apiService.fetchIndicator("BTC-USD"),
        this.apiService.fetchMultiIndicator("BTC-USD"),
      ]);

      // Process single indicator data
      if (
        indicatorData.status === "fulfilled" &&
        indicatorData.value?.success
      ) {
        this.updateSingleIndicators(indicatorData.value);
        this.updateIndicatorsTable(indicatorData.value);
      } else {
        console.warn(
          "Failed to load single indicator data:",
          indicatorData.reason
        );
      }

      // Process multi-indicator data
      if (multiData.status === "fulfilled" && multiData.value?.success) {
        this.updateMultiIndicatorSummary(multiData.value);
      } else {
        console.warn("Failed to load multi-indicator data:", multiData.reason);
        this.showMultiIndicatorFallback();
      }
    } catch (error) {
      console.error("❌ Error loading indicators data:", error);
    } finally {
      // Reset button state
      if (refreshBtn) refreshBtn.disabled = false;
      if (refreshText) refreshText.textContent = "Refresh Data";
    }
  }

  updateSingleIndicators(data) {
    if (!data?.data?.length) return;

    // Get the latest indicator data (first item since it's ordered by time desc)
    const latest = data.data[0];
    const indicators = latest.indicators;

    // Render the main indicator analysis section
    this.renderIndicatorAnalysis(indicators);

    // Update moving averages
    this.updateElement(
      "[data-sma20-value]",
      indicators.sma?.[20]?.toFixed(0) || "--"
    );
    this.updateElement(
      "[data-sma50-value]",
      indicators.sma?.[50]?.toFixed(0) || "--"
    );
    this.updateElement(
      "[data-ema20-value]",
      indicators.ema?.[20]?.toFixed(0) || "--"
    );
    this.updateElement(
      "[data-ema50-value]",
      indicators.ema?.[50]?.toFixed(0) || "--"
    );

    // Update oscillators
    this.updateElement(
      "[data-rsi-value]",
      indicators.rsi?.[14]?.toFixed(2) || "--"
    );
    this.updateElement(
      "[data-stoch-k-value]",
      indicators.stochastic?.["%K"]?.toFixed(1) || "--"
    );
    this.updateElement(
      "[data-stoch-rsi-k-value]",
      indicators.stochasticRsi?.["%K"]?.toFixed(1) || "--"
    );

    // Update volatility indicators
    this.updateElement(
      "[data-bb-upper]",
      indicators.bollingerBands?.upper?.toFixed(0) || "--"
    );
    this.updateElement(
      "[data-bb-lower]",
      indicators.bollingerBands?.lower?.toFixed(0) || "--"
    );
    this.updateElement(
      "[data-psar-value]",
      indicators.parabolicSar?.value?.toFixed(0) || "--"
    );

    // Update MACD
    this.updateElement(
      "[data-macd-line]",
      indicators.macd?.macd?.toFixed(2) || "--"
    );
    this.updateElement(
      "[data-macd-signal]",
      indicators.macd?.signalLine?.toFixed(2) || "--"
    );
    this.updateElement(
      "[data-macd-histogram]",
      indicators.macd?.histogram?.toFixed(2) || "--"
    );

    // Update signals with color coding
    this.updateSignalElement("[data-sma20-signal]", indicators.sma?.signal);
    this.updateSignalElement("[data-sma50-signal]", indicators.sma?.signal);
    this.updateSignalElement("[data-ema20-signal]", indicators.ema?.signal);
    this.updateSignalElement("[data-ema50-signal]", indicators.ema?.signal);
    this.updateSignalElement("[data-rsi-signal]", indicators.rsi?.signal);
    this.updateSignalElement(
      "[data-stoch-signal]",
      indicators.stochastic?.signal
    );
    this.updateSignalElement(
      "[data-stoch-rsi-signal]",
      indicators.stochasticRsi?.signal
    );
    this.updateSignalElement(
      "[data-psar-signal]",
      indicators.parabolicSar?.signal
    );
    this.updateSignalElement(
      "[data-macd-overall-signal]",
      indicators.macd?.signal
    );
  }

  // New method to render the 3-column indicator analysis
  renderIndicatorAnalysis(indicators) {
    const trendIndicators = [
      {
        name: "SMA(20)",
        value: indicators.sma?.[20],
        signal: indicators.sma?.signal,
      },
      {
        name: "SMA(50)",
        value: indicators.sma?.[50],
        signal: indicators.sma?.signal,
      },
      {
        name: "EMA(20)",
        value: indicators.ema?.[20],
        signal: indicators.ema?.signal,
      },
      {
        name: "EMA(50)",
        value: indicators.ema?.[50],
        signal: indicators.ema?.signal,
      },
      {
        name: "PSAR",
        value: indicators.parabolicSar?.value,
        signal: indicators.parabolicSar?.signal,
      },
    ];

    const momentumIndicators = [
      {
        name: "RSI(14)",
        value: indicators.rsi?.[14],
        signal: indicators.rsi?.signal,
      },
      {
        name: "Stochastic %K",
        value: indicators.stochastic?.["%K"],
        signal: indicators.stochastic?.signal,
      },
      {
        name: "Stoch RSI %K",
        value: indicators.stochasticRsi?.["%K"],
        signal: indicators.stochasticRsi?.signal,
      },
      {
        name: "MACD",
        value: indicators.macd?.macd,
        signal: indicators.macd?.signal,
      },
    ];

    const volatilityIndicators = [
      {
        name: "Bollinger Upper",
        value: indicators.bollingerBands?.upper,
        signal: indicators.bollingerBands?.signal,
      },
      {
        name: "Bollinger Lower",
        value: indicators.bollingerBands?.lower,
        signal: indicators.bollingerBands?.signal,
      },
    ];

    // Helper to colorize signals
    const signalColor = (signal) =>
      signal === "buy"
        ? "text-green-500 dark:text-green-400"
        : signal === "sell"
        ? "text-red-500 dark:text-red-400"
        : "text-gray-400 dark:text-gray-500";

    // Render each category as a card
    const createCard = (title, badgeColor, items) => `
      <div class="bg-white dark:bg-[#1E2235] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex justify-between items-center mb-3">
          <h3 class="font-semibold text-gray-900 dark:text-white">${title}</h3>
          <span class="text-xs px-2 py-0.5 rounded-full ${badgeColor}">${
      title === "Volatility" ? "Support/Resistance" : title
    }</span>
        </div>
        ${items
          .map(
            (i) => `
          <div class="flex justify-between items-center text-sm mb-2">
            <span class="text-gray-600 dark:text-gray-300">${i.name}</span>
            <div class="text-right">
              <span class="font-semibold text-gray-900 dark:text-white block">${
                i.value ? i.value.toFixed(2) : "--"
              }</span>
              <span class="text-xs ${signalColor(
                i.signal
              )} uppercase font-medium">${i.signal || "neutral"}</span>
            </div>
          </div>`
          )
          .join("")}
      </div>`;

    const indicatorSection = document.querySelector("#indicator-section");
    if (indicatorSection) {
      indicatorSection.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          ${createCard(
            "Trend",
            "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
            trendIndicators
          )}
          ${createCard(
            "Momentum",
            "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300",
            momentumIndicators
          )}
          ${createCard(
            "Volatility",
            "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
            volatilityIndicators
          )}
        </div>`;
    }
  }

  updateIndicatorsTable(data) {
    const tableBody = document.getElementById("indicators-table-body");
    if (!tableBody || !data?.data?.length) return;

    const latest = data.data[0];
    const indicators = latest.indicators;

    const tableData = [
      {
        name: "SMA(20)",
        value: indicators.sma?.[20],
        signal: indicators.sma?.signal,
        category: "Trend",
      },
      {
        name: "SMA(50)",
        value: indicators.sma?.[50],
        signal: indicators.sma?.signal,
        category: "Trend",
      },
      {
        name: "EMA(20)",
        value: indicators.ema?.[20],
        signal: indicators.ema?.signal,
        category: "Trend",
      },
      {
        name: "EMA(50)",
        value: indicators.ema?.[50],
        signal: indicators.ema?.signal,
        category: "Trend",
      },
      {
        name: "RSI(14)",
        value: indicators.rsi?.[14],
        signal: indicators.rsi?.signal,
        category: "Momentum",
      },
      {
        name: "MACD",
        value: indicators.macd?.macd,
        signal: indicators.macd?.signal,
        category: "Momentum",
      },
      {
        name: "Stochastic %K",
        value: indicators.stochastic?.["%K"],
        signal: indicators.stochastic?.signal,
        category: "Momentum",
      },
      {
        name: "Stoch RSI %K",
        value: indicators.stochasticRsi?.["%K"],
        signal: indicators.stochasticRsi?.signal,
        category: "Momentum",
      },
      {
        name: "Bollinger Bands",
        value: indicators.bollingerBands?.upper,
        signal: indicators.bollingerBands?.signal,
        category: "Volatility",
      },
      {
        name: "Parabolic SAR",
        value: indicators.parabolicSar?.value,
        signal: indicators.parabolicSar?.signal,
        category: "Trend",
      },
    ];

    tableBody.innerHTML = tableData
      .map((item) => {
        const { icon, color } = this.getSignalDisplay(item.signal);
        const categoryColor = this.getCategoryColor(item.category);

        return `
        <tr class="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
          <td class="py-4 px-2 font-medium text-gray-900 dark:text-gray-100">${
            item.name
          }</td>
          <td class="py-4 px-2 text-center font-mono text-gray-900 dark:text-gray-100">
            ${item.value ? item.value.toFixed(2) : "--"}
          </td>
          <td class="py-4 px-2 text-center">
            <span class="${color} flex items-center justify-center">
              ${icon} ${(item.signal || "neutral").toUpperCase()}
            </span>
          </td>
          <td class="py-4 px-2 text-center">
            <span class="${categoryColor} text-xs px-2 py-1 rounded-full">
              ${item.category}
            </span>
          </td>
        </tr>
      `;
      })
      .join("");
  }

  updateMultiIndicatorSummary(data) {
    if (!data?.data?.length) {
      this.showMultiIndicatorFallback();
      return;
    }

    const latest = data.data[0];

    // Update overall signal
    this.updateOverallSignal(latest.multiIndicator, latest.totalScore);

    // Update score progress bar
    this.updateScoreProgressBar(latest.totalScore);

    // Update category scores
    this.updateCategoryScores(latest.categoryScores);

    // Update individual signals breakdown
    this.updateIndividualSignals(latest.signals);
  }

  updateOverallSignal(signal, score) {
    const iconElement = document.getElementById("overall-signal-icon");
    const textElement = document.getElementById("overall-signal-text");
    const scoreElement = document.getElementById("overall-signal-score");

    if (iconElement && textElement && scoreElement) {
      const { icon, color } = this.getSignalDisplay(signal?.toLowerCase());

      iconElement.textContent = icon.replace(/[🟢🔴⚪]/g, ""); // Remove existing colored circles
      iconElement.className = `text-3xl mb-2 ${color}`;

      textElement.textContent = (signal || "HOLD").toUpperCase();
      textElement.className = `text-xl font-bold mb-2 ${color}`;

      scoreElement.textContent = `Score: ${score ? score.toFixed(3) : "--"}`;
    }
  }

  updateScoreProgressBar(score) {
    const progressBar = document.getElementById("score-progress-bar");
    if (!progressBar || score === null || score === undefined) return;

    // Convert score from -1 to +1 range to 0-100% for progress bar
    const percentage = ((score + 1) / 2) * 100;
    const clampedPercentage = Math.max(0, Math.min(100, percentage));

    // Determine color based on score
    let colorClass = "bg-gray-400";
    if (score > 0.1) {
      colorClass = "bg-gradient-to-r from-green-400 to-green-600";
    } else if (score < -0.1) {
      colorClass = "bg-gradient-to-r from-red-400 to-red-600";
    }

    progressBar.style.width = `${clampedPercentage}%`;
    progressBar.className = `h-3 rounded-full transition-all duration-500 ${colorClass}`;
  }

  updateCategoryScores(categoryScores) {
    if (!categoryScores) return;

    this.updateElement(
      "[data-trend-score]",
      categoryScores.trend ? categoryScores.trend.toFixed(2) : "--",
      this.getScoreColor(categoryScores.trend)
    );
    this.updateElement(
      "[data-momentum-score]",
      categoryScores.momentum ? categoryScores.momentum.toFixed(2) : "--",
      this.getScoreColor(categoryScores.momentum)
    );
    this.updateElement(
      "[data-volatility-score]",
      categoryScores.volatility ? categoryScores.volatility.toFixed(2) : "--",
      this.getScoreColor(categoryScores.volatility)
    );
  }

  updateIndividualSignals(signals) {
    const container = document.getElementById("individual-signals");
    if (!container || !signals) return;

    const signalItems = Object.entries(signals).map(([key, signal]) => {
      const { icon, color } = this.getSignalDisplay(signal);
      const displayName = this.getSignalDisplayName(key);

      return `
        <div class="flex justify-between items-center py-1">
          <span class="text-sm text-gray-600 dark:text-gray-400">${displayName}</span>
          <span class="${color} text-sm font-medium">
            ${icon} ${(signal || "neutral").toUpperCase()}
          </span>
        </div>
      `;
    });

    container.innerHTML = signalItems.join("");
  }

  showMultiIndicatorFallback() {
    // Show neutral HOLD state when multi-indicator API fails
    this.updateOverallSignal("HOLD", 0);
    this.updateScoreProgressBar(0);

    const container = document.getElementById("individual-signals");
    if (container) {
      container.innerHTML = `
        <div class="text-center text-gray-500 dark:text-gray-400 py-4">
          <span class="text-sm">Multi-indicator analysis unavailable</span>
        </div>
      `;
    }
  }

  // Utility methods
  updateElement(selector, value, additionalClass = "") {
    const element = document.querySelector(selector);
    if (element) {
      element.textContent = value;
      if (additionalClass) {
        element.className = `${element.className
          .split(" ")
          .filter((c) => !c.includes("text-"))
          .join(" ")} ${additionalClass}`;
      }
    }
  }

  updateSignalElement(selector, signal) {
    const element = document.querySelector(selector);
    if (element) {
      const { icon, color } = this.getSignalDisplay(signal);
      element.innerHTML = `<span class="${color}">${icon} ${(
        signal || "neutral"
      ).toUpperCase()}</span>`;
    }
  }

  getSignalDisplay(signal) {
    switch ((signal || "").toLowerCase()) {
      case "buy":
        return { icon: "🟢", color: "text-green-600 dark:text-green-400" };
      case "sell":
        return { icon: "🔴", color: "text-red-600 dark:text-red-400" };
      case "neutral":
      case "hold":
      default:
        return { icon: "⚪", color: "text-gray-500 dark:text-gray-400" };
    }
  }

  getCategoryColor(category) {
    switch (category.toLowerCase()) {
      case "trend":
        return "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300";
      case "momentum":
        return "bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300";
      case "volatility":
        return "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300";
      default:
        return "bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300";
    }
  }

  getScoreColor(score) {
    if (!score && score !== 0) return "text-gray-500 dark:text-gray-400";

    if (score > 0.1) {
      return "text-green-600 dark:text-green-400";
    } else if (score < -0.1) {
      return "text-red-600 dark:text-red-400";
    }
    return "text-gray-600 dark:text-gray-400";
  }

  getSignalDisplayName(key) {
    const names = {
      rsi: "RSI",
      macd: "MACD",
      sma: "SMA",
      ema: "EMA",
      psar: "PSAR",
      boll: "Bollinger",
      stoch: "Stochastic",
      stochRsi: "Stoch RSI",
    };
    return names[key] || key.toUpperCase();
  }
}
