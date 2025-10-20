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
      "start-date",
      "end-date",
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

    console.warn(
      "⚠️ Some elements not found after waiting, continuing anyway..."
    );
    // Don't throw error, just continue - some elements might be optional
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    console.log("🔧 Setting up comparison event listeners...");

    // Set default date values
    this.setDefaultDateRange();

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

    // Date validation
    const startDateInput = document.getElementById("start-date");
    const endDateInput = document.getElementById("end-date");

    if (startDateInput && endDateInput) {
      startDateInput.addEventListener("change", () => this.validateDateRange());
      endDateInput.addEventListener("change", () => this.validateDateRange());
    }

    console.log("🔧 Event listeners configured");
  }

  /**
   * Set default date range (last 60 days)
   */
  setDefaultDateRange() {
    const startDateInput = document.getElementById("start-date");
    const endDateInput = document.getElementById("end-date");

    if (startDateInput && endDateInput) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 60);

      startDateInput.value = startDate.toISOString().split("T")[0];
      endDateInput.value = endDate.toISOString().split("T")[0];

      console.log("📅 Default date range set:", {
        start: startDateInput.value,
        end: endDateInput.value,
      });
    }
  }

  /**
   * Validate date range
   */
  validateDateRange() {
    const startDateInput = document.getElementById("start-date");
    const endDateInput = document.getElementById("end-date");
    const runBtn = document.getElementById("run-comparison");

    if (!startDateInput || !endDateInput || !runBtn) return;

    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);
    const today = new Date();

    let isValid = true;
    let errorMessage = "";

    // Check if start date is after end date
    if (startDate >= endDate) {
      isValid = false;
      errorMessage = "Start date must be before end date";
    }

    // Check if end date is in the future
    if (endDate > today) {
      isValid = false;
      errorMessage = "End date cannot be in the future";
    }

    // Check if date range is too long (more than 1 year)
    const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      isValid = false;
      errorMessage = "Date range cannot exceed 1 year";
    }

    // Check if date range is too short (less than 7 days)
    if (daysDiff < 7) {
      isValid = false;
      errorMessage = "Date range must be at least 7 days";
    }

    // Update UI based on validation
    if (!isValid) {
      runBtn.disabled = true;
      runBtn.title = errorMessage;
      startDateInput.classList.add("border-red-500");
      endDateInput.classList.add("border-red-500");
    } else {
      runBtn.disabled = false;
      runBtn.title = "";
      startDateInput.classList.remove("border-red-500");
      endDateInput.classList.remove("border-red-500");
    }

    return isValid;
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

    try {
      // Get form values
      const symbol =
        document.getElementById("symbol-select")?.value || "BTC-USD";

      // Get date range values
      const startDate = document.getElementById("start-date")?.value;
      const endDate = document.getElementById("end-date")?.value;

      // Fallback to default dates if not provided
      let start, end;
      if (startDate && endDate) {
        start = startDate;
        end = endDate;
      } else {
        // Default to last 60 days
        const endDateObj = new Date();
        const startDateObj = new Date();
        startDateObj.setDate(startDateObj.getDate() - 60);
        start = startDateObj.toISOString().split("T")[0];
        end = endDateObj.toISOString().split("T")[0];
      }

      const requestBody = {
        symbol,
        start,
        end,
      };

      // Show loading state
      this.showLoadingState();
      this.startProgressSimulation();

      console.log("📡 Sending comparison request:", requestBody);

      const result = await this.apiService.fetchComparison(requestBody);

      console.log("🔍 Raw API response:", result);

      // Check if we have a valid response
      if (!result) {
        throw new Error("No response received from comparison API");
      }

      // Handle the response structure: { success: true, symbol: "BTC-USD", comparison: { single: {...}, multi: {...}, bestStrategy: "...", bestSingleIndicator: "..." } }
      let comparisonData;
      if (result.success && result.comparison) {
        comparisonData = {
          symbol: result.symbol,
          comparison: {
            single: result.comparison.single,
            multi: result.comparison.multi,
          },
          bestStrategy: result.comparison.bestStrategy,
          bestSingleIndicator: result.comparison.bestSingleIndicator,
        };
      } else if (result.data) {
        // Old API format fallback
        comparisonData = result.data;
      } else {
        throw new Error("Invalid response format from comparison API");
      }

      console.log("✅ Processed comparison data:", comparisonData);

      this.currentComparison = comparisonData;
      this.displayResults(comparisonData);
    } catch (error) {
      console.error("❌ Comparison failed:", error);
      this.showErrorState(error.message || "Unknown error occurred");
    } finally {
      // Always stop progress simulation
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
  displayResults(data) {
    console.log("📊 Displaying results:", data);

    try {
      // Validate data structure first
      if (!data || typeof data !== "object") {
        throw new Error("Invalid data structure received");
      }

      if (!data.comparison) {
        throw new Error("Missing comparison data in response");
      }

      if (!data.comparison.single || !data.comparison.multi) {
        throw new Error("Missing single or multi indicator data");
      }

      if (!data.bestSingleIndicator || !data.bestStrategy) {
        throw new Error("Missing bestSingleIndicator or bestStrategy fields");
      }

      // Hide loading and error states
      const loading = document.getElementById("comparison-loading");
      const error = document.getElementById("comparison-error");
      const results = document.getElementById("comparison-results");

      if (loading) loading.classList.add("hidden");
      if (error) error.classList.add("hidden");
      if (results) results.classList.remove("hidden");

      // Store the full response for later use
      this.currentComparison = data;

      // Update all result sections with new format
      try {
        this.updateOverviewCards(data);
        console.log("✅ Overview cards updated");
      } catch (err) {
        console.error("❌ Error updating overview cards:", err);
      }

      try {
        this.updateSingleIndicatorsTable(data);
        console.log("✅ Single indicators table updated");
      } catch (err) {
        console.error("❌ Error updating single indicators table:", err);
      }

      try {
        this.updateMultiIndicatorMetrics(data);
        console.log("✅ Multi-indicator metrics updated");
      } catch (err) {
        console.error("❌ Error updating multi-indicator metrics:", err);
      }

      try {
        this.updateBestStrategyHighlight(data);
        console.log("✅ Best strategy highlight updated");
      } catch (err) {
        console.error("❌ Error updating best strategy highlight:", err);
      }

      try {
        this.createComparisonChart(data);
        console.log("✅ Comparison chart created");
      } catch (err) {
        console.error("❌ Error creating comparison chart:", err);
      }

      try {
        this.generateRecommendations(data);
        console.log("✅ Recommendations generated");
      } catch (err) {
        console.error("❌ Error generating recommendations:", err);
      }

      console.log("✅ Results displayed successfully");
    } catch (error) {
      console.error("❌ Error in displayResults:", error);
      this.showErrorState(`Failed to display results: ${error.message}`);
    }
  }

  /**
   * Update overview cards with summary metrics
   */
  updateOverviewCards(data) {
    const { comparison, bestStrategy, bestSingleIndicator } = data;

    // Helper function to format values
    const fmt = (val) =>
      val === undefined || val === null ? "-" : val.toFixed(2) + "%";

    // Winner card
    const winnerText =
      bestStrategy === "single"
        ? `Single (${bestSingleIndicator})`
        : "Multi-Indicator";
    this.updateElement("winner-strategy", winnerText);

    // Calculate improvement (example logic - adapt based on your needs)
    const bestSingleROI = comparison.single[bestSingleIndicator]?.roi || 0;
    const multiROI = comparison.multi?.roi || 0;
    const improvement =
      bestStrategy === "single"
        ? Math.abs(bestSingleROI - multiROI)
        : Math.abs(multiROI - bestSingleROI);
    this.updateElement(
      "winner-improvement",
      `+${improvement.toFixed(1)}% better ROI`
    );

    // ROI difference
    const roiDiff = multiROI - bestSingleROI;
    this.updateElement(
      "roi-difference",
      `${roiDiff >= 0 ? "+" : ""}${roiDiff.toFixed(1)}%`
    );

    // Drawdown difference
    const bestSingleDrawdown =
      comparison.single[bestSingleIndicator]?.maxDrawdown || 0;
    const multiDrawdown = comparison.multi?.maxDrawdown || 0;
    const drawdownDiff = multiDrawdown - bestSingleDrawdown;
    this.updateElement(
      "drawdown-difference",
      `${drawdownDiff >= 0 ? "+" : ""}${drawdownDiff.toFixed(1)}%`
    );

    // Win rate difference
    const bestSingleWinRate =
      comparison.single[bestSingleIndicator]?.winRate || 0;
    const multiWinRate = comparison.multi?.winRate || 0;
    const winrateDiff = multiWinRate - bestSingleWinRate;
    this.updateElement(
      "winrate-difference",
      `${winrateDiff >= 0 ? "+" : ""}${winrateDiff.toFixed(1)}%`
    );
  }

  /**
   * Create dynamic table for single indicators
   */
  updateSingleIndicatorsTable(data) {
    const { comparison, bestSingleIndicator } = data;

    // Helper function to format values
    const fmt = (val) =>
      val === undefined || val === null ? "-" : val.toFixed(2) + "%";
    const fmtNum = (val) =>
      val === undefined || val === null ? "-" : val.toString();

    // Find the single indicator section and replace with table
    let singleCard = document.querySelector("#single-roi")?.closest(".card");

    // Fallback: try to find any card with single-related content
    if (!singleCard) {
      singleCard = document.querySelector('[id*="single"]')?.closest(".card");
    }

    // If still not found, create a new container
    if (!singleCard) {
      const resultsContainer = document.getElementById("comparison-results");
      if (resultsContainer) {
        const newCard = document.createElement("div");
        newCard.className = "card bg-white shadow-lg rounded-lg mb-6";
        resultsContainer.appendChild(newCard);
        singleCard = newCard;
      } else {
        console.warn(
          "⚠️ Could not find results container for single indicators table"
        );
        return;
      }
    }

    const tableHTML = `
      <div class="card-body p-6">
        <h3 class="text-lg font-semibold mb-4 flex items-center">
          <span class="mr-2">📊</span>
          Single Indicator Strategies
        </h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="text-left py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">Indicator</th>
                <th class="text-center py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">ROI</th>
                <th class="text-center py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">Win Rate</th>
                <th class="text-center py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">Max Drawdown</th>
                <th class="text-center py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">Trades</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(comparison.single)
                .map(([name, stats]) => {
                  const isBest = name === bestSingleIndicator;
                  const rowClass = isBest
                    ? "bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700";
                  const nameClass = isBest
                    ? "font-bold text-green-700 dark:text-green-400 flex items-center"
                    : "font-medium text-gray-900 dark:text-gray-100";

                  return `
                  <tr class="${rowClass} border-b border-gray-100 dark:border-gray-700">
                    <td class="py-3 px-2">
                      <span class="${nameClass}">
                        ${isBest ? "🏆 " : ""}${name.toUpperCase()}
                      </span>
                    </td>
                    <td class="py-3 px-2 text-center font-mono ${
                      stats.roi >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }">${fmt(stats.roi)}</td>
                    <td class="py-3 px-2 text-center font-mono text-blue-600 dark:text-blue-400">${fmt(
                      stats.winRate
                    )}</td>
                    <td class="py-3 px-2 text-center font-mono text-red-600 dark:text-red-400">${fmt(
                      stats.maxDrawdown
                    )}</td>
                    <td class="py-3 px-2 text-center font-mono text-gray-700 dark:text-gray-300">${fmtNum(
                      stats.trades
                    )}</td>
                  </tr>
                `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
        <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p class="text-sm text-blue-700 dark:text-blue-300">
            <strong>Best single indicator:</strong> ${bestSingleIndicator.toUpperCase()} 
            (ROI: ${fmt(comparison.single[bestSingleIndicator]?.roi)}, 
            WinRate: ${fmt(comparison.single[bestSingleIndicator]?.winRate)})
          </p>
        </div>
      </div>
    `;

    singleCard.innerHTML = tableHTML;
  }

  /**
   * Update multi-indicator performance card
   */
  updateMultiIndicatorMetrics(data) {
    const { comparison } = data;
    const multi = comparison.multi;

    // Helper function to format values
    const fmt = (val) =>
      val === undefined || val === null ? "-" : val.toFixed(2) + "%";
    const fmtNum = (val) =>
      val === undefined || val === null ? "-" : val.toString();

    // Try to update existing elements, with fallbacks
    const updateElementSafe = (id, value) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      } else {
        console.warn(
          `⚠️ Element with id '${id}' not found for multi-indicator metrics`
        );
      }
    };

    // Update multi indicator metrics
    updateElementSafe("multi-roi", fmt(multi.roi));
    updateElementSafe("multi-winrate", fmt(multi.winRate));
    updateElementSafe("multi-drawdown", fmt(multi.maxDrawdown));
    updateElementSafe("multi-trades", fmtNum(multi.trades));

    // Add profit factor if available (set to calculated value or placeholder)
    const profitFactor = multi.profitFactor || (multi.roi > 0 ? 1.2 : 0.8); // Placeholder calculation
    updateElementSafe("multi-profit-factor", profitFactor.toFixed(2));

    // If elements don't exist, create a fallback multi-indicator card
    if (!document.getElementById("multi-roi")) {
      this.createFallbackMultiIndicatorCard(data);
    }
  }

  /**
   * Create fallback multi-indicator card if DOM elements are missing
   */
  createFallbackMultiIndicatorCard(data) {
    const { comparison } = data;
    const multi = comparison.multi;

    const fmt = (val) =>
      val === undefined || val === null ? "-" : val.toFixed(2) + "%";
    const fmtNum = (val) =>
      val === undefined || val === null ? "-" : val.toString();

    const resultsContainer = document.getElementById("comparison-results");
    if (!resultsContainer) return;

    const multiCard = document.createElement("div");
    multiCard.className =
      "card bg-white dark:bg-gray-800 shadow-lg rounded-lg mb-6";
    multiCard.innerHTML = `
      <div class="card-body p-6">
        <h3 class="text-lg font-semibold mb-4 flex items-center text-gray-900 dark:text-gray-100">
          <span class="mr-2">⚖️</span>
          Multi-Indicator Performance
        </h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="text-center">
            <div class="text-2xl font-bold ${
              multi.roi >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }">${fmt(multi.roi)}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">ROI</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">${fmt(
              multi.winRate
            )}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">Win Rate</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-red-600 dark:text-red-400">${fmt(
              multi.maxDrawdown
            )}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">Max Drawdown</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-gray-700 dark:text-gray-300">${fmtNum(
              multi.trades
            )}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">Trades</div>
          </div>
        </div>
      </div>
    `;

    resultsContainer.appendChild(multiCard);
    console.log("✅ Created fallback multi-indicator card");
  }

  /**
   * Highlight the best strategy
   */
  updateBestStrategyHighlight(data) {
    const { bestStrategy, bestSingleIndicator } = data;

    // Remove existing highlights
    document.querySelectorAll(".card").forEach((card) => {
      card.classList.remove("ring-2", "ring-green-500", "bg-green-50");
    });

    // Add highlight to winner
    if (bestStrategy === "single") {
      // Highlight the single indicators table
      const singleCard =
        document.querySelector("#single-roi").closest(".card") ||
        document.querySelector("h3").closest(".card");
      if (singleCard) {
        singleCard.classList.add("ring-2", "ring-green-500");
      }
    } else {
      // Highlight the multi-indicator card
      const multiCard = document.querySelector("#multi-roi").closest(".card");
      if (multiCard) {
        multiCard.classList.add("ring-2", "ring-green-500");
      }
    }
  }

  /**
   * Update indicator weights display (simplified for new format)
   */
  updateIndicatorWeights(data) {
    const weightsContainer = document.getElementById("indicator-weights");
    if (!weightsContainer) return;

    // Since the new API doesn't provide weights, show placeholder or hide section
    weightsContainer.innerHTML = `
      <div class="text-center py-8 text-gray-500">
        <div class="text-3xl mb-2">⚖️</div>
        <p class="text-sm">Multi-indicator weights</p>
        <p class="text-xs text-gray-400 mt-1">Balanced weighting applied</p>
      </div>
    `;
  }

  /**
   * Generate recommendations based on results
   */
  generateRecommendations(data) {
    const recommendationsContainer = document.getElementById(
      "recommendations-list"
    );
    if (!recommendationsContainer) return;

    const { comparison, bestStrategy, bestSingleIndicator } = data;
    const recommendations = [];

    // Strategy recommendation
    if (bestStrategy === "single") {
      recommendations.push({
        type: "strategy",
        priority: "high",
        message: `Consider using ${bestSingleIndicator.toUpperCase()} as your primary indicator. It shows the best performance among single indicators.`,
      });
    } else {
      recommendations.push({
        type: "strategy",
        priority: "high",
        message:
          "Multi-indicator strategy outperforms single indicators. Consider diversifying your signal sources.",
      });
    }

    // Risk recommendation
    const multiDrawdown = comparison.multi?.maxDrawdown || 0;
    if (multiDrawdown > 50) {
      recommendations.push({
        type: "risk",
        priority: "medium",
        message: `Multi-indicator strategy has high drawdown (${multiDrawdown.toFixed(
          1
        )}%). Consider position sizing or stop-loss adjustments.`,
      });
    }

    // Performance recommendation
    const bestROI =
      bestStrategy === "single"
        ? comparison.single[bestSingleIndicator]?.roi || 0
        : comparison.multi?.roi || 0;

    if (bestROI < 0) {
      recommendations.push({
        type: "performance",
        priority: "high",
        message:
          "Both strategies show negative returns. Consider market conditions or parameter adjustments before deployment.",
      });
    }

    // Render recommendations
    recommendationsContainer.innerHTML = recommendations
      .map((rec) => {
        const priorityColor =
          rec.priority === "high"
            ? "border-red-200 bg-red-50"
            : rec.priority === "medium"
            ? "border-yellow-200 bg-yellow-50"
            : "border-blue-200 bg-blue-50";

        return `
        <div class="border-l-4 ${priorityColor} p-4 rounded-lg">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 mt-1">
              ${
                rec.type === "strategy"
                  ? "🎯"
                  : rec.type === "risk"
                  ? "🛡️"
                  : "💡"
              }
            </div>
            <div>
              <p class="text-sm text-gray-700">${rec.message}</p>
              <span class="text-xs text-gray-500 capitalize">${
                rec.priority
              } priority</span>
            </div>
          </div>
        </div>
      `;
      })
      .join("");
  }

  /**
   * Create comparison chart with new data format
   */
  createComparisonChart(data) {
    const chartContainer = document.getElementById("comparison-chart");
    if (!chartContainer) return;

    const { comparison, bestSingleIndicator } = data;
    const bestSingleROI = comparison.single[bestSingleIndicator]?.roi || 0;
    const multiROI = comparison.multi?.roi || 0;
    const maxROI = Math.max(Math.abs(bestSingleROI), Math.abs(multiROI));

    chartContainer.innerHTML = `
      <div class="w-full h-full flex flex-col justify-center space-y-4">
        <div class="text-center mb-4">
          <h4 class="font-semibold text-gray-700">ROI Comparison</h4>
        </div>
        
        <!-- Best Single Indicator Bar -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-600">🏆 ${bestSingleIndicator.toUpperCase()}</span>
            <span class="text-sm font-semibold ${
              bestSingleROI >= 0 ? "text-green-600" : "text-red-600"
            }">
              ${bestSingleROI.toFixed(1)}%
            </span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-4">
            <div class="h-4 rounded-full ${
              bestSingleROI >= 0 ? "bg-green-500" : "bg-red-500"
            }" 
                 style="width: ${
                   maxROI > 0 ? (Math.abs(bestSingleROI) / maxROI) * 100 : 0
                 }%"></div>
          </div>
        </div>
        
        <!-- Multi Indicator Bar -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-600">⚖️ MULTI-INDICATOR</span>
            <span class="text-sm font-semibold ${
              multiROI >= 0 ? "text-green-600" : "text-red-600"
            }">
              ${multiROI.toFixed(1)}%
            </span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-4">
            <div class="h-4 rounded-full ${
              multiROI >= 0 ? "bg-blue-500" : "bg-red-500"
            }" 
                 style="width: ${
                   maxROI > 0 ? (Math.abs(multiROI) / maxROI) * 100 : 0
                 }%"></div>
          </div>
        </div>
        
        <div class="text-center text-xs text-gray-500 mt-4">
          Difference: ${(multiROI - bestSingleROI).toFixed(1)}% ${
      multiROI > bestSingleROI
        ? "favoring multi-indicator"
        : `favoring ${bestSingleIndicator.toUpperCase()}`
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
      symbol: this.currentComparison.symbol,
      comparison: this.currentComparison.comparison,
      bestStrategy: this.currentComparison.bestStrategy,
      bestSingleIndicator: this.currentComparison.bestSingleIndicator,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparison_${this.currentComparison.symbol}_${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("📊 Results exported successfully");
  }

  /**
   * Debug method to check current page state
   */
  debugPageState() {
    console.log("🔍 DEBUG: Current ComparisonPage state:");
    console.log("- isInitialized:", this.isInitialized);
    console.log("- currentComparison:", this.currentComparison);
    console.log("- progressInterval:", this.progressInterval);

    // Check required DOM elements
    const elements = [
      "run-comparison",
      "symbol-select",
      "start-date",
      "end-date",
      "comparison-loading",
      "comparison-results",
      "comparison-error",
    ];

    console.log("🔍 DOM Elements check:");
    elements.forEach((id) => {
      const element = document.getElementById(id);
      console.log(`- ${id}:`, element ? "✅ Found" : "❌ Missing");
    });

    // Check API service
    console.log("🔍 API Service:", this.apiService);

    return {
      isInitialized: this.isInitialized,
      hasCurrentComparison: !!this.currentComparison,
      hasProgressInterval: !!this.progressInterval,
      elementsFound: elements.filter((id) => document.getElementById(id)),
      elementsMissing: elements.filter((id) => !document.getElementById(id)),
    };
  }

  /**
   * Debug method to test API connection
   */
  async debugApiConnection() {
    console.log("🔍 DEBUG: Testing API connection...");

    try {
      const testRequest = {
        symbol: "BTC-USD",
        start: "2024-10-01",
        end: "2024-10-18",
      };

      console.log("📡 Test request:", testRequest);

      const result = await this.apiService.fetchComparison(testRequest);
      console.log("✅ API Response:", result);

      return result;
    } catch (error) {
      console.error("❌ API Test failed:", error);
      return { error: error.message };
    }
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
