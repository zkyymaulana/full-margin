/**
 * 🎯 Comparison Page Class - Manages strategy comparison functionality
 */
import { ApiService } from "../services/api.service.js";

export class ComparisonPage {
  constructor() {
    this.apiService = new ApiService();
    this.currentComparison = null;
    this.progressInterval = null;
    this.isInitialized = false;

    console.log("🎯 ComparisonPage class initialized");
  }

  /**
   * Initialize the comparison page
   */
  async initialize() {
    if (this.isInitialized) {
      console.log("⚠️ ComparisonPage already initialized");
      return;
    }

    console.log("🚀 Initializing ComparisonPage...");

    // Wait for DOM elements to be available
    await this.waitForElements();

    // Setup event listeners
    this.setupEventListeners();

    // Load available indicators
    await this.loadAvailableIndicators();

    this.isInitialized = true;
    console.log("✅ ComparisonPage initialized successfully");
  }

  /**
   * Wait for required DOM elements to be available
   */
  async waitForElements() {
    const requiredElements = [
      "run-comparison",
      "symbol-select",
      "single-indicator-select",
      "period-select",
    ];

    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait

    while (attempts < maxAttempts) {
      const missingElements = requiredElements.filter(
        (id) => !document.getElementById(id)
      );

      if (missingElements.length === 0) {
        console.log("✅ All required elements found");
        return;
      }

      console.log(`⏳ Waiting for elements: ${missingElements.join(", ")}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    console.warn("⚠️ Some elements not found after waiting");
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    console.log("🔧 Setting up comparison event listeners...");

    // Main comparison button
    const runBtn = document.getElementById("run-comparison");
    if (runBtn) {
      runBtn.addEventListener("click", () => this.runComparison());
    }

    // Refresh button
    const refreshBtn = document.getElementById("refresh-comparison");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => this.runComparison());
    }

    // Export button
    const exportBtn = document.getElementById("export-results");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportResults());
    }

    // Retry button (for errors)
    const retryBtn = document.getElementById("retry-comparison");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => this.runComparison());
    }

    // Symbol change - update available indicators
    const symbolSelect = document.getElementById("symbol-select");
    if (symbolSelect) {
      symbolSelect.addEventListener("change", (e) => {
        this.loadAvailableIndicators(e.target.value);
      });
    }

    console.log("🔧 Event listeners configured");
  }

  /**
   * Load available indicators for selected symbol
   */
  async loadAvailableIndicators(symbol = "BTC-USD") {
    try {
      const response = await this.apiService.fetchAvailableIndicators(symbol);
      if (response && response.success) {
        this.updateIndicatorOptions(response.data.indicators);
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

    // Store current selection
    const currentValue = select.value;

    // Clear existing options
    select.innerHTML = "";

    // Add available indicators
    indicators.forEach((indicator) => {
      const option = document.createElement("option");
      option.value = indicator.name;
      option.textContent = indicator.displayName;
      select.appendChild(option);
    });

    // Restore selection if still available
    if (
      currentValue &&
      [...select.options].some((opt) => opt.value === currentValue)
    ) {
      select.value = currentValue;
    }

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

      const result = await this.apiService.fetchComparison(requestBody);

      if (result && result.success) {
        console.log("✅ Comparison completed:", result);
        this.currentComparison = result.data;
        this.displayResults(result.data);
      } else {
        throw new Error("Invalid response from comparison API");
      }
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
    const results = document.getElementById("comparison-results");
    const error = document.getElementById("comparison-error");
    const loading = document.getElementById("comparison-loading");

    if (results) results.classList.add("hidden");
    if (error) error.classList.add("hidden");
    if (loading) loading.classList.remove("hidden");
  }

  /**
   * Show error state
   */
  showErrorState(message) {
    const results = document.getElementById("comparison-results");
    const loading = document.getElementById("comparison-loading");
    const error = document.getElementById("comparison-error");

    if (results) results.classList.add("hidden");
    if (loading) loading.classList.add("hidden");
    if (error) error.classList.remove("hidden");

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
    const loading = document.getElementById("comparison-loading");
    const error = document.getElementById("comparison-error");
    const results = document.getElementById("comparison-results");

    if (loading) loading.classList.add("hidden");
    if (error) error.classList.add("hidden");
    if (results) results.classList.remove("hidden");

    // Update all result sections
    this.updateOverviewCards(comparisonData);
    this.updateDetailedMetrics(comparisonData);
    this.updateIndicatorWeights(comparisonData);
    this.updateRecommendations(comparisonData);
    this.createComparisonChart(comparisonData);

    console.log("✅ Results displayed successfully");
  }

  /**
   * Update overview cards with summary metrics
   */
  updateOverviewCards(data) {
    const { summary, comparison } = data;

    // Winner card
    this.updateElement(
      "winner-strategy",
      summary.winner === "single" ? "Single Indicator" : "Multi-Indicator"
    );
    this.updateElement(
      "winner-improvement",
      `+${summary.roiDifference.toFixed(1)}% better ROI`
    );

    // ROI difference
    const roiDiff = comparison.roiComparison.difference;
    this.updateElement(
      "roi-difference",
      `${roiDiff >= 0 ? "+" : ""}${roiDiff.toFixed(1)}%`
    );

    // Drawdown difference
    const drawdownDiff = comparison.maxDrawdownComparison.difference;
    this.updateElement(
      "drawdown-difference",
      `${drawdownDiff >= 0 ? "+" : ""}${drawdownDiff.toFixed(1)}%`
    );

    // Win rate difference
    const winrateDiff = comparison.winRateComparison.difference;
    this.updateElement(
      "winrate-difference",
      `${winrateDiff >= 0 ? "+" : ""}${winrateDiff.toFixed(1)}%`
    );
  }

  /**
   * Update detailed metrics for both strategies
   */
  updateDetailedMetrics(data) {
    const { singleIndicator, multiIndicator } = data;

    // Update single indicator title
    this.updateElement(
      "single-indicator-title",
      `${singleIndicator.name.toUpperCase()} Strategy`
    );

    // Single indicator metrics
    this.updateElement(
      "single-roi",
      `${singleIndicator.metrics.roi.toFixed(1)}%`
    );
    this.updateElement(
      "single-winrate",
      `${singleIndicator.metrics.winRate.toFixed(1)}%`
    );
    this.updateElement(
      "single-drawdown",
      `${singleIndicator.metrics.maxDrawdown.toFixed(1)}%`
    );
    this.updateElement(
      "single-profit-factor",
      singleIndicator.metrics.profitFactor.toFixed(2)
    );
    this.updateElement(
      "single-trades",
      singleIndicator.metrics.totalTrades.toString()
    );

    // Multi indicator metrics
    this.updateElement(
      "multi-roi",
      `${multiIndicator.metrics.roi.toFixed(1)}%`
    );
    this.updateElement(
      "multi-winrate",
      `${multiIndicator.metrics.winRate.toFixed(1)}%`
    );
    this.updateElement(
      "multi-drawdown",
      `${multiIndicator.metrics.maxDrawdown.toFixed(1)}%`
    );
    this.updateElement(
      "multi-profit-factor",
      multiIndicator.metrics.profitFactor.toFixed(2)
    );
    this.updateElement(
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
   * Helper function to update element content
   */
  updateElement(elementId, value) {
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

  /**
   * Handle page visibility changes
   */
  handleVisibilityChange(hidden) {
    if (hidden) {
      // Pause any ongoing operations when page is hidden
      this.stopProgressSimulation();
    }
  }

  /**
   * Cleanup when page is destroyed
   */
  destroy() {
    console.log("🧹 Destroying ComparisonPage...");

    this.stopProgressSimulation();
    this.currentComparison = null;
    this.isInitialized = false;

    console.log("✅ ComparisonPage destroyed");
  }
}

console.log("✅ ComparisonPage class loaded");
