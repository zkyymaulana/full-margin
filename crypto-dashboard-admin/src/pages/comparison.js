/**
 * 🎯 Strategy Comparison Page - JavaScript Logic
 * Handles single vs multi-indicator strategy comparison with visualization
 */

// Import API service for authenticated requests
import { ApiService } from "../services/api.service.js";

class ComparisonPage {
  constructor() {
    this.apiService = new ApiService();
    this.currentComparison = null;
    this.progressInterval = null;

    console.log("🎯 ComparisonPage initialized");
  }

  /**
   * Initialize the comparison page
   */
  init() {
    this.setupEventListeners();
    this.loadAvailableIndicators();
    console.log("✅ Comparison page ready");
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Main comparison button
    document.getElementById("run-comparison")?.addEventListener("click", () => {
      this.runComparison();
    });

    // Refresh button
    document
      .getElementById("refresh-comparison")
      ?.addEventListener("click", () => {
        this.runComparison();
      });

    // Export button
    document.getElementById("export-results")?.addEventListener("click", () => {
      this.exportResults();
    });

    // Retry button (for errors)
    document
      .getElementById("retry-comparison")
      ?.addEventListener("click", () => {
        this.runComparison();
      });

    // Symbol change - update available indicators
    document
      .getElementById("symbol-select")
      ?.addEventListener("change", (e) => {
        this.loadAvailableIndicators(e.target.value);
      });

    console.log("🔧 Event listeners configured");
  }

  /**
   * Load available indicators for selected symbol
   */
  async loadAvailableIndicators(symbol = "BTC-USD") {
    try {
      const response = await fetch(
        `${this.apiService.baseURL}/comparison/indicators/${symbol}`,
        {
          headers: this.apiService.getAuthHeaders(),
        }
      );

      if (response.ok) {
        const data = await response.json();
        this.updateIndicatorOptions(data.data.indicators);
      }
    } catch (error) {
      console.warn("⚠️ Could not load indicators:", error);
      // Keep default options if API fails
    }
  }

  /**
   * Update indicator dropdown options
   */
  updateIndicatorOptions(indicators) {
    const select = document.getElementById("single-indicator-select");
    if (!select || !indicators) return;

    // Clear existing options
    select.innerHTML = "";

    // Add available indicators
    indicators.forEach((indicator) => {
      const option = document.createElement("option");
      option.value = indicator.name;
      option.textContent = indicator.displayName;
      select.appendChild(option);
    });

    console.log(`🔧 Updated indicators: ${indicators.length} available`);
  }

  /**
   * Run the strategy comparison
   */
  async runComparison() {
    console.log("🚀 Starting strategy comparison...");

    // Get form values
    const symbol = document.getElementById("symbol-select")?.value || "BTC-USD";
    const singleIndicator =
      document.getElementById("single-indicator-select")?.value || "rsi";
    const days = parseInt(
      document.getElementById("period-select")?.value || "60"
    );

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const requestBody = {
      symbol,
      singleIndicator,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      timeframe: "1h",
      initialCapital: 10000,
    };

    // Show loading state
    this.showLoadingState();
    this.startProgressSimulation();

    try {
      console.log("📡 Sending comparison request:", requestBody);

      const response = await fetch(
        `${this.apiService.baseURL}/comparison/compare`,
        {
          method: "POST",
          headers: this.apiService.getAuthHeaders(),
          body: JSON.stringify(requestBody),
        }
      );

      if (response.status === 401) {
        // Unauthorized - redirect to login
        localStorage.clear();
        window.location.href = "/src/pages/login.html";
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Comparison completed:", result);

      this.currentComparison = result.data;
      this.displayResults(result.data);
    } catch (error) {
      console.error("❌ Comparison failed:", error);
      this.showErrorState(error.message);
    } finally {
      this.stopProgressSimulation();
    }
  }

  /**
   * Show loading state with progress simulation
   */
  showLoadingState() {
    document.getElementById("comparison-results")?.classList.add("hidden");
    document.getElementById("comparison-error")?.classList.add("hidden");
    document.getElementById("comparison-loading")?.classList.remove("hidden");
  }

  /**
   * Show error state
   */
  showErrorState(message) {
    document.getElementById("comparison-results")?.classList.add("hidden");
    document.getElementById("comparison-loading")?.classList.add("hidden");
    document.getElementById("comparison-error")?.classList.remove("hidden");

    const errorMsg = document.getElementById("error-message");
    if (errorMsg) {
      errorMsg.textContent = message;
    }
  }

  /**
   * Simulate progress during comparison
   */
  startProgressSimulation() {
    const progressBar = document.getElementById("progress-bar");
    const progressText = document.getElementById("progress-text");

    const stages = [
      { progress: 20, text: "Fetching historical data..." },
      { progress: 40, text: "Generating signals..." },
      { progress: 60, text: "Running backtest simulation..." },
      { progress: 80, text: "Calculating metrics..." },
      { progress: 95, text: "Finalizing results..." },
      { progress: 100, text: "Complete!" },
    ];

    let currentStage = 0;
    this.progressInterval = setInterval(() => {
      if (currentStage < stages.length) {
        const stage = stages[currentStage];
        if (progressBar) progressBar.style.width = `${stage.progress}%`;
        if (progressText) progressText.textContent = stage.text;
        currentStage++;
      }
    }, 800);
  }

  /**
   * Stop progress simulation
   */
  stopProgressSimulation() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  /**
   * Display comparison results
   */
  displayResults(comparisonData) {
    console.log("📊 Displaying results...");

    // Hide loading and error states
    document.getElementById("comparison-loading")?.classList.add("hidden");
    document.getElementById("comparison-error")?.classList.add("hidden");
    document.getElementById("comparison-results")?.classList.remove("hidden");

    // Update overview cards
    this.updateOverviewCards(comparisonData);

    // Update detailed metrics
    this.updateDetailedMetrics(comparisonData);

    // Update indicator weights
    this.updateIndicatorWeights(comparisonData);

    // Update recommendations
    this.updateRecommendations(comparisonData);

    // Create comparison chart
    this.createComparisonChart(comparisonData);

    console.log("✅ Results displayed successfully");
  }

  /**
   * Update overview cards with summary metrics
   */
  updateOverviewCards(data) {
    const { summary, comparison } = data;

    // Winner card
    const winnerEl = document.getElementById("winner-strategy");
    const improvementEl = document.getElementById("winner-improvement");

    if (winnerEl) {
      winnerEl.textContent =
        summary.winner === "single" ? "Single Indicator" : "Multi-Indicator";
    }
    if (improvementEl) {
      improvementEl.textContent = `+${summary.roiDifference.toFixed(
        1
      )}% better ROI`;
    }

    // ROI difference
    const roiDiffEl = document.getElementById("roi-difference");
    if (roiDiffEl) {
      const diff = comparison.roiComparison.difference;
      roiDiffEl.textContent = `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
      roiDiffEl.className = `text-lg font-bold ${
        diff >= 0 ? "text-green-600" : "text-red-600"
      }`;
    }

    // Drawdown difference
    const drawdownDiffEl = document.getElementById("drawdown-difference");
    if (drawdownDiffEl) {
      const diff = comparison.maxDrawdownComparison.difference;
      drawdownDiffEl.textContent = `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
      drawdownDiffEl.className = `text-lg font-bold ${
        diff <= 0 ? "text-green-600" : "text-red-600"
      }`;
    }

    // Win rate difference
    const winrateDiffEl = document.getElementById("winrate-difference");
    if (winrateDiffEl) {
      const diff = comparison.winRateComparison.difference;
      winrateDiffEl.textContent = `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
      winrateDiffEl.className = `text-lg font-bold ${
        diff >= 0 ? "text-green-600" : "text-red-600"
      }`;
    }
  }

  /**
   * Update detailed metrics for both strategies
   */
  updateDetailedMetrics(data) {
    const { singleIndicator, multiIndicator } = data;

    // Update single indicator title
    const titleEl = document.getElementById("single-indicator-title");
    if (titleEl) {
      titleEl.textContent = `${singleIndicator.name.toUpperCase()} Strategy`;
    }

    // Single indicator metrics
    this.updateMetricElement(
      "single-roi",
      `${singleIndicator.metrics.roi.toFixed(1)}%`
    );
    this.updateMetricElement(
      "single-winrate",
      `${singleIndicator.metrics.winRate.toFixed(1)}%`
    );
    this.updateMetricElement(
      "single-drawdown",
      `${singleIndicator.metrics.maxDrawdown.toFixed(1)}%`
    );
    this.updateMetricElement(
      "single-profit-factor",
      singleIndicator.metrics.profitFactor.toFixed(2)
    );
    this.updateMetricElement(
      "single-trades",
      singleIndicator.metrics.totalTrades.toString()
    );

    // Multi indicator metrics
    this.updateMetricElement(
      "multi-roi",
      `${multiIndicator.metrics.roi.toFixed(1)}%`
    );
    this.updateMetricElement(
      "multi-winrate",
      `${multiIndicator.metrics.winRate.toFixed(1)}%`
    );
    this.updateMetricElement(
      "multi-drawdown",
      `${multiIndicator.metrics.maxDrawdown.toFixed(1)}%`
    );
    this.updateMetricElement(
      "multi-profit-factor",
      multiIndicator.metrics.profitFactor.toFixed(2)
    );
    this.updateMetricElement(
      "multi-trades",
      multiIndicator.metrics.totalTrades.toString()
    );
  }

  /**
   * Update indicator weights display
   */
  updateIndicatorWeights(data) {
    const weightsContainer = document.getElementById("indicator-weights");
    if (!weightsContainer) return;

    const weights = data.multiIndicator.config;
    weightsContainer.innerHTML = "";

    Object.entries(weights).forEach(([indicator, weight]) => {
      const percentage = (weight * 100).toFixed(0);
      const weightElement = document.createElement("div");
      weightElement.className =
        "flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg";

      weightElement.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span class="font-medium text-gray-700">${indicator.toUpperCase()}</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-20 bg-gray-200 rounded-full h-2">
            <div class="bg-blue-500 h-2 rounded-full" style="width: ${percentage}%"></div>
          </div>
          <span class="text-sm font-semibold text-gray-600">${percentage}%</span>
        </div>
      `;

      weightsContainer.appendChild(weightElement);
    });
  }

  /**
   * Update recommendations list
   */
  updateRecommendations(data) {
    const recommendationsContainer = document.getElementById(
      "recommendations-list"
    );
    if (!recommendationsContainer || !data.recommendations) return;

    recommendationsContainer.innerHTML = "";

    data.recommendations.forEach((rec) => {
      const recElement = document.createElement("div");
      const priorityColor =
        rec.priority === "high"
          ? "border-red-200 bg-red-50"
          : rec.priority === "medium"
          ? "border-yellow-200 bg-yellow-50"
          : "border-blue-200 bg-blue-50";

      recElement.className = `border-l-4 ${priorityColor} p-4 rounded-lg`;
      recElement.innerHTML = `
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 mt-1">
            ${
              rec.type === "strategy" ? "🎯" : rec.type === "risk" ? "🛡️" : "💡"
            }
          </div>
          <div>
            <p class="text-sm text-gray-700">${rec.message}</p>
            <span class="text-xs text-gray-500 capitalize">${
              rec.priority
            } priority</span>
          </div>
        </div>
      `;

      recommendationsContainer.appendChild(recElement);
    });
  }

  /**
   * Create comparison chart (simple bar chart using CSS)
   */
  createComparisonChart(data) {
    const chartContainer = document.getElementById("comparison-chart");
    if (!chartContainer) return;

    const singleROI = data.singleIndicator.metrics.roi;
    const multiROI = data.multiIndicator.metrics.roi;
    const maxROI = Math.max(Math.abs(singleROI), Math.abs(multiROI));

    chartContainer.innerHTML = `
      <div class="w-full h-full flex flex-col justify-center space-y-4">
        <div class="text-center mb-4">
          <h4 class="font-semibold text-gray-700">ROI Comparison</h4>
        </div>
        
        <!-- Single Indicator Bar -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-600">${data.singleIndicator.name.toUpperCase()}</span>
            <span class="text-sm font-semibold ${
              singleROI >= 0 ? "text-green-600" : "text-red-600"
            }">${singleROI.toFixed(1)}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-4">
            <div class="h-4 rounded-full ${
              singleROI >= 0 ? "bg-green-500" : "bg-red-500"
            }" 
                 style="width: ${(Math.abs(singleROI) / maxROI) * 100}%"></div>
          </div>
        </div>
        
        <!-- Multi Indicator Bar -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-600">MULTI-INDICATOR</span>
            <span class="text-sm font-semibold ${
              multiROI >= 0 ? "text-green-600" : "text-red-600"
            }">${multiROI.toFixed(1)}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-4">
            <div class="h-4 rounded-full ${
              multiROI >= 0 ? "bg-blue-500" : "bg-red-500"
            }" 
                 style="width: ${(Math.abs(multiROI) / maxROI) * 100}%"></div>
          </div>
        </div>
        
        <div class="text-center text-xs text-gray-500 mt-4">
          Difference: ${(multiROI - singleROI).toFixed(1)}% ${
      multiROI > singleROI
        ? "favoring multi-indicator"
        : "favoring single indicator"
    }
        </div>
      </div>
    `;
  }

  /**
   * Helper function to update metric elements
   */
  updateMetricElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value;
    }
  }

  /**
   * Export comparison results
   */
  exportResults() {
    if (!this.currentComparison) {
      alert("No comparison results to export");
      return;
    }

    const exportData = {
      timestamp: new Date().toISOString(),
      comparison: this.currentComparison,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparison_${this.currentComparison.summary.period.startDate}_${this.currentComparison.summary.period.endDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("📊 Results exported successfully");
  }
}

// Initialize comparison page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Initializing Comparison Page...");

  const comparisonPage = new ComparisonPage();
  comparisonPage.init();

  // Make it globally available for debugging
  window.comparisonPage = comparisonPage;
});

console.log("✅ Comparison page script loaded");
