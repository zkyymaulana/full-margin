/**
 * Indicators Page Module
 */
import { ApiService } from "../services/api.service.js";

export class IndicatorsPage {
  constructor() {
    this.apiService = new ApiService();
    this.isActive = false;
  }

  async initialize() {
    console.log("🧮 Initializing Technical Indicators page...");
    this.isActive = true;

    // Setup refresh button
    const refreshBtn = document.getElementById("refresh-indicators");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        await this.loadIndicatorsData();
      });
    }

    // Load initial data
    await this.loadIndicatorsData();
  }

  destroy() {
    console.log("🧹 Destroying Indicators page...");
    this.isActive = false;
  }

  async loadIndicatorsData() {
    try {
      const [btcData, ethData] = await Promise.allSettled([
        this.apiService.fetchAnalysis("BTC-USD"),
        this.apiService.fetchAnalysis("ETH-USD"),
      ]);

      if (btcData.status === "fulfilled" && btcData.value?.success) {
        this.updateIndicatorsPageData(btcData.value);
        this.updateIndicatorsTable(btcData.value);
      }
    } catch (error) {
      console.error("❌ Error loading indicators data:", error);
    }
  }

  updateIndicatorsPageData(data) {
    if (!data?.indicators) return;

    const indicators = data.indicators;

    const elements = {
      "[data-sma20-value]": indicators.sma20?.toFixed(0),
      "[data-ema20-value]": indicators.ema20?.toFixed(0),
      "[data-rsi-value]": indicators.rsi?.toFixed(2),
      "[data-stoch-value]": indicators.stochastic?.k?.toFixed(1),
      "[data-bb-upper]": indicators.bollinger?.upper?.toFixed(0),
      "[data-bb-lower]": indicators.bollinger?.lower?.toFixed(0),
      "[data-macd-line]": indicators.macd?.line?.toFixed(2),
      "[data-macd-signal]": indicators.macd?.signal?.toFixed(2),
    };

    Object.entries(elements).forEach(([selector, value]) => {
      const el = document.querySelector(selector);
      if (el && value !== undefined) {
        el.textContent = value;
      }
    });

    this.updateTrendIndicators(indicators);
  }

  updateTrendIndicators(indicators) {
    const rsiStatus = document.querySelector("[data-rsi-status]");
    if (rsiStatus) {
      const rsi = indicators.rsi;
      if (rsi > 70) {
        rsiStatus.innerHTML = '<span class="text-red-500">📉 Overbought</span>';
      } else if (rsi < 30) {
        rsiStatus.innerHTML = '<span class="text-green-500">📈 Oversold</span>';
      } else {
        rsiStatus.innerHTML = '<span class="text-gray-500">➡️ Neutral</span>';
      }
    }
  }

  updateIndicatorsTable(data) {
    const tableBody = document.getElementById("indicators-table-body");
    if (!tableBody || !data?.indicators) return;

    const indicators = data.indicators;
    const tableData = [
      {
        name: "SMA20",
        value: indicators.sma20,
        signal: this.getSMASignal(indicators),
        strength: "Medium",
      },
      {
        name: "EMA20",
        value: indicators.ema20,
        signal: this.getEMASignal(indicators),
        strength: "High",
      },
      {
        name: "RSI(14)",
        value: indicators.rsi,
        signal: this.getRSISignal(indicators.rsi),
        strength: "High",
      },
      {
        name: "MACD",
        value: indicators.macd?.line,
        signal: this.getMACDSignal(indicators.macd),
        strength: "Medium",
      },
      {
        name: "Stochastic %K",
        value: indicators.stochastic?.k,
        signal: this.getStochasticSignal(indicators.stochastic),
        strength: "Medium",
      },
      {
        name: "Bollinger Upper",
        value: indicators.bollinger?.upper,
        signal: "NEUTRAL",
        strength: "Low",
      },
      {
        name: "PSAR",
        value: indicators.psar,
        signal: this.getPSARSignal(indicators),
        strength: "Medium",
      },
    ];

    tableBody.innerHTML = tableData
      .map((item) => {
        const trendIcon =
          item.signal === "BUY" ? "📈" : item.signal === "SELL" ? "📉" : "➡️";
        const signalColor =
          item.signal === "BUY"
            ? "text-green-600"
            : item.signal === "SELL"
            ? "text-red-600"
            : "text-gray-600";
        const strengthColor =
          item.strength === "High"
            ? "text-green-600"
            : item.strength === "Medium"
            ? "text-yellow-600"
            : "text-gray-600";

        return `
        <tr class="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
          <td class="py-4 px-2 font-medium text-gray-900 dark:text-gray-100">${
            item.name
          }</td>
          <td class="py-4 px-2 text-center font-mono">${
            item.value ? item.value.toFixed(2) : "--"
          }</td>
          <td class="py-4 px-2 text-center">${trendIcon}</td>
          <td class="py-4 px-2 text-center font-medium ${signalColor}">${
          item.signal
        }</td>
          <td class="py-4 px-2 text-center ${strengthColor}">${
          item.strength
        }</td>
        </tr>
      `;
      })
      .join("");
  }

  // Signal calculation helpers
  getSMASignal(indicators) {
    if (!indicators.sma20) return "NEUTRAL";
    return indicators.sma20 > (indicators.sma50 || indicators.sma20)
      ? "BUY"
      : "SELL";
  }

  getEMASignal(indicators) {
    if (!indicators.ema20) return "NEUTRAL";
    return indicators.ema20 > indicators.sma20 ? "BUY" : "SELL";
  }

  getRSISignal(rsi) {
    if (!rsi) return "NEUTRAL";
    if (rsi < 30) return "BUY";
    if (rsi > 70) return "SELL";
    return "NEUTRAL";
  }

  getMACDSignal(macd) {
    if (!macd?.line || !macd?.signal) return "NEUTRAL";
    return macd.line > macd.signal ? "BUY" : "SELL";
  }

  getStochasticSignal(stoch) {
    if (!stoch?.k) return "NEUTRAL";
    if (stoch.k < 20) return "BUY";
    if (stoch.k > 80) return "SELL";
    return "NEUTRAL";
  }

  getPSARSignal(indicators) {
    if (!indicators.psar || !indicators.sma20) return "NEUTRAL";
    return indicators.sma20 > indicators.psar ? "BUY" : "SELL";
  }
}
