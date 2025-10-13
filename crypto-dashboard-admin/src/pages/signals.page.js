/**
 * Signals Page Module
 */
import { ApiService } from "../services/api.service.js";

export class SignalsPage {
  constructor() {
    this.apiService = new ApiService();
    this.autoRefreshInterval = null;
    this.autoRefreshActive = true;
    this.isActive = false;
  }

  async initialize() {
    console.log("⚡ Initializing Live Signals page...");
    this.isActive = true;

    // Setup auto-refresh toggle
    this.setupAutoRefreshToggle();

    // Load initial signals data
    await this.loadSignalsData();

    // Start auto-refresh
    this.startAutoRefresh();
  }

  destroy() {
    console.log("🧹 Destroying Signals page...");
    this.isActive = false;

    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  setupAutoRefreshToggle() {
    const toggleBtn = document.getElementById("toggle-auto-refresh");

    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        this.autoRefreshActive = !this.autoRefreshActive;
        toggleBtn.textContent = this.autoRefreshActive ? "Pause" : "Resume";
        toggleBtn.className = this.autoRefreshActive
          ? "px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          : "px-3 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors";
      });
    }
  }

  startAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }

    this.autoRefreshInterval = setInterval(async () => {
      if (this.autoRefreshActive && this.isActive) {
        await this.loadSignalsData();
      }
    }, 5000);
  }

  async loadSignalsData() {
    try {
      const signalsData = await this.generateMockSignalsData();
      this.updateSignalsPageData(signalsData);
      this.updateSignalsTable(signalsData.signals);

      // Update last update timestamp
      const lastUpdateEl = document.getElementById("signals-last-update");
      if (lastUpdateEl) {
        lastUpdateEl.textContent = new Date().toLocaleTimeString();
      }
    } catch (error) {
      console.error("❌ Error loading signals data:", error);
    }
  }

  async generateMockSignalsData() {
    const signals = [];
    const symbols = ["BTC-USD", "ETH-USD"];
    const indicators = ["RSI", "MACD", "SMA", "Bollinger", "Stochastic"];
    const actions = ["BUY", "SELL"];

    for (let i = 0; i < 15; i++) {
      signals.push({
        id: i + 1,
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
        indicator: indicators[Math.floor(Math.random() * indicators.length)],
        action: actions[Math.floor(Math.random() * actions.length)],
        confidence: (60 + Math.random() * 40).toFixed(1),
        price: (45000 + Math.random() * 20000).toFixed(2),
        status: Math.random() > 0.3 ? "Active" : "Closed",
      });
    }

    const buyCount = signals.filter((s) => s.action === "BUY").length;
    const sellCount = signals.filter((s) => s.action === "SELL").length;
    const avgConfidence = (
      signals.reduce((sum, s) => sum + parseFloat(s.confidence), 0) /
      signals.length
    ).toFixed(1);

    return {
      signals,
      summary: {
        total: signals.length,
        buy: buyCount,
        sell: sellCount,
        avgConfidence,
      },
    };
  }

  updateSignalsPageData(data) {
    const elements = {
      "total-signals-today": data.summary.total,
      "buy-signals-count": data.summary.buy,
      "sell-signals-count": data.summary.sell,
      "avg-confidence": `${data.summary.avgConfidence}%`,
      "chart-buy-count": data.summary.buy,
      "chart-sell-count": data.summary.sell,
    };

    Object.entries(elements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });
  }

  updateSignalsTable(signals) {
    const tableBody = document.getElementById("signals-table-body");
    if (!tableBody) return;

    tableBody.innerHTML = signals
      .map((signal) => {
        const actionColor =
          signal.action === "BUY" ? "text-green-600" : "text-red-600";
        const statusColor =
          signal.status === "Active" ? "text-green-600" : "text-gray-600";
        const timestamp = new Date(signal.timestamp).toLocaleString();

        return `
        <tr class="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
          <td class="py-4 px-3 text-sm">${timestamp}</td>
          <td class="py-4 px-3 font-medium">${signal.symbol}</td>
          <td class="py-4 px-3 text-center text-sm">${signal.indicator}</td>
          <td class="py-4 px-3 text-center font-bold ${actionColor}">${signal.action}</td>
          <td class="py-4 px-3 text-center">${signal.confidence}%</td>
          <td class="py-4 px-3 text-center font-mono">$${signal.price}</td>
          <td class="py-4 px-3 text-center ${statusColor}">${signal.status}</td>
        </tr>
      `;
      })
      .join("");
  }
}
