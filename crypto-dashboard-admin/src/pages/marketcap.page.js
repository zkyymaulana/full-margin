/**
 * Market Cap Page Module
 */
import { ApiService } from "../services/api.service.js";

export class MarketCapPage {
  constructor() {
    this.apiService = new ApiService();
    this.isActive = false;
    this.refreshInterval = null;
  }

  async initialize() {
    console.log("🪙 Initializing Market Cap page...");
    
    // Prevent double initialization
    if (this.isActive) {
      console.log("⚠️ Market Cap already active, destroying first...");
      this.destroy();
    }
    
    this.isActive = true;

    // Setup refresh button
    const refreshBtn = document.getElementById("refresh-marketcap");
    if (refreshBtn) {
      // Remove existing event listeners to prevent duplicates
      refreshBtn.replaceWith(refreshBtn.cloneNode(true));
      const newRefreshBtn = document.getElementById("refresh-marketcap");
      newRefreshBtn.addEventListener("click", async () => {
        await this.loadMarketCapData();
      });
    }

    // Load initial data
    await this.loadMarketCapData();

    // Start auto-refresh every 3 seconds
    this.startAutoRefresh();
  }

  destroy() {
    console.log("🧹 Destroying Market Cap page...");
    this.isActive = false;
    
    // Stop auto-refresh
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    // Clean up any dynamically created elements
    this.cleanupDynamicElements();
  }

  cleanupDynamicElements() {
    // Remove any chart section containers if they exist from previous navigations
    const existingChartContainer = document.getElementById('top-coins-display');
    if (existingChartContainer) {
      existingChartContainer.remove();
      console.log("🧹 Removed existing market cap chart container");
    }
  }

  startAutoRefresh() {
    // Clear existing interval if any
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // Set up auto-refresh every 3 seconds
    this.refreshInterval = setInterval(async () => {
      if (this.isActive) {
        await this.loadMarketCapData();
      }
    }, 3000);

    console.log("🔄 Auto-refresh started (every 3 seconds)");
  }

  async loadMarketCapData() {
    try {
      // Use ApiService instead of direct fetch to handle authentication
      const data = await this.apiService.fetchMarketCap();

      if (data && data.success && data.data) {
        // Update main market cap table
        this.updateMarketCapTable(data.data);

        // Update chart section with top 5 coins
        this.updateChartSection(data.data.slice(0, 5));

        // Update summary cards
        this.updateSummaryCards(data.data);

        // Update last update timestamp
        const lastUpdate = document.getElementById("marketcap-last-update");
        if (lastUpdate) {
          lastUpdate.textContent = new Date().toLocaleTimeString();
          lastUpdate.className =
            "text-xs font-medium text-gray-700 dark:text-gray-300";
        }

        console.log(`✅ Market cap data updated: ${data.data.length} coins`);
      } else {
        console.warn("⚠️ Invalid response from market cap API:", data);

        // Show error in UI
        const lastUpdate = document.getElementById("marketcap-last-update");
        if (lastUpdate) {
          lastUpdate.textContent =
            "API Error - " + new Date().toLocaleTimeString();
          lastUpdate.className = "text-xs font-medium text-red-500";
        }
      }
    } catch (error) {
      console.error("❌ Failed to fetch live market cap:", error);

      // Handle authentication errors
      if (error.message && error.message.includes("401")) {
        console.log("🔒 Authentication failed, redirecting to login...");
        localStorage.removeItem("authToken");
        localStorage.removeItem("userId");
        localStorage.removeItem("userEmail");
        window.location.href = "/src/pages/login.html";
        return;
      }

      // Update last update with error indicator
      const lastUpdate = document.getElementById("marketcap-last-update");
      if (lastUpdate) {
        lastUpdate.textContent = "Error - " + new Date().toLocaleTimeString();
        lastUpdate.className = "text-xs font-medium text-red-500";
      }
    }
  }

  updateSummaryCards(coins) {
    if (!coins || coins.length === 0) return;

    // Calculate summary metrics
    const totalMarketCap = coins.reduce((sum, coin) => {
      // Estimate market cap using price * volume (simplified calculation)
      return sum + coin.price * coin.volume;
    }, 0);

    const totalVolume = coins.reduce(
      (sum, coin) => sum + coin.volume * coin.price,
      0
    );

    // Calculate BTC dominance (assuming first coin is BTC)
    const btcMarketCap = coins[0] ? coins[0].price * coins[0].volume : 0;
    const btcDominance =
      totalMarketCap > 0
        ? ((btcMarketCap / totalMarketCap) * 100).toFixed(1)
        : 0;

    const formatCurrency = (value) => {
      if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
      if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
      if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
      if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
      return `$${value.toLocaleString()}`;
    };

    // Update summary cards
    const elements = {
      "total-market-cap": formatCurrency(totalMarketCap),
      "total-volume": formatCurrency(totalVolume),
      "btc-dominance": `${btcDominance}%`,
      "active-coins": coins.length.toLocaleString(),
    };

    Object.entries(elements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });

    // Update BTC dominance bar
    const dominanceBar = document.getElementById("btc-dominance-bar");
    if (dominanceBar) {
      dominanceBar.style.width = `${Math.max(btcDominance, 5)}%`; // Minimum 5% for visibility
    }
  }

  updateChartSection(topCoins) {
    if (!topCoins || topCoins.length === 0) return;

    // Find the chart section in dashboard
    const chartSection = document
      .querySelector("#candlestick-chart")
      .closest(".card");
    if (!chartSection) return;

    // Create or update the top coins display
    let topCoinsContainer = document.getElementById("top-coins-display");

    if (!topCoinsContainer) {
      // Create new container after the chart
      topCoinsContainer = document.createElement("div");
      topCoinsContainer.id = "top-coins-display";
      topCoinsContainer.className =
        "mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg";

      const header = document.createElement("h4");
      header.className =
        "text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4";
      header.innerHTML = "🏆 Top 5 Cryptocurrencies";
      topCoinsContainer.appendChild(header);

      const coinsGrid = document.createElement("div");
      coinsGrid.id = "top-coins-grid";
      coinsGrid.className = "grid grid-cols-1 md:grid-cols-5 gap-4";
      topCoinsContainer.appendChild(coinsGrid);

      chartSection.querySelector(".card-body").appendChild(topCoinsContainer);
    }

    // Update the coins grid
    const coinsGrid = document.getElementById("top-coins-grid");
    if (coinsGrid) {
      coinsGrid.innerHTML = topCoins
        .map((coin, index) => {
          const formatPrice = (price) => {
            if (price >= 1000) return `$${(price / 1000).toFixed(1)}K`;
            if (price >= 1) return `$${price.toFixed(2)}`;
            return `$${price.toFixed(6)}`;
          };

          const formatTime = (timestamp) => {
            return new Date(timestamp).toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
            });
          };

          return `
          <div class="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-6 h-6 bg-gradient-to-r ${this.getCoinGradient(
                index
              )} rounded-full flex items-center justify-center text-white text-xs font-bold">
                ${coin.rank}
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">${
                  coin.name
                }</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">${
                  coin.symbol
                }</div>
              </div>
            </div>
            <div class="space-y-1">
              <div class="font-mono text-sm font-bold text-gray-900 dark:text-gray-100">${formatPrice(
                coin.price
              )}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                Vol: ${(coin.volume / 1000).toFixed(1)}K
              </div>
              <div class="text-xs text-gray-400 dark:text-gray-500">
                ${formatTime(coin.time)}
              </div>
            </div>
          </div>
        `;
        })
        .join("");
    }

    console.log(`📊 Updated chart section with ${topCoins.length} top coins`);
  }

  getCoinGradient(index) {
    const gradients = [
      "from-yellow-500 to-orange-500", // Gold for #1
      "from-gray-400 to-gray-600", // Silver for #2
      "from-amber-600 to-amber-800", // Bronze for #3
      "from-blue-500 to-purple-500", // Blue-purple for #4
      "from-green-500 to-teal-500", // Green-teal for #5
    ];
    return gradients[index] || "from-gray-500 to-gray-700";
  }

  updateMarketCapTable(coins) {
    const tableBody = document.getElementById("marketcap-table-body");
    if (!tableBody) return;

    tableBody.innerHTML = coins
      .map((coin) => {
        // Calculate 24h change percentage from open and current price
        const change24h = coin.open
          ? ((coin.price - coin.open) / coin.open) * 100
          : 0;
        const changeColor =
          change24h >= 0
            ? "text-green-600 dark:text-green-400"
            : "text-red-600 dark:text-red-400";
        const changeSign = change24h >= 0 ? "+" : "";

        // Format price
        const formatPrice = (price) => {
          if (price >= 1000)
            return price.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
          if (price >= 1) return price.toFixed(2);
          return price.toFixed(6);
        };

        // Format volume
        const formatVolume = (volume) => {
          if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
          if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
          if (volume >= 1e3) return `${(volume / 1e3).toFixed(2)}K`;
          return volume.toFixed(2);
        };

        // Estimate market cap (simplified calculation)
        const estimatedMarketCap = coin.price * coin.volume;
        const formatMarketCap = (marketCap) => {
          if (marketCap >= 1e12) return `${(marketCap / 1e12).toFixed(2)}T`;
          if (marketCap >= 1e9) return `${(marketCap / 1e9).toFixed(2)}B`;
          if (marketCap >= 1e6) return `${(marketCap / 1e6).toFixed(2)}M`;
          return `${(marketCap / 1e3).toFixed(2)}K`;
        };

        return `
        <tr class="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
          <td class="py-4 px-3 font-medium text-gray-900 dark:text-gray-100">${
            coin.rank
          }</td>
          <td class="py-4 px-3">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 bg-gradient-to-r ${this.getCoinGradient(
                coin.rank - 1
              )} rounded-full flex items-center justify-center text-white text-xs font-bold">
                ${coin.rank}
              </div>
              <span class="font-medium text-gray-900 dark:text-gray-100">${
                coin.name
              }</span>
            </div>
          </td>
          <td class="py-4 px-3 text-center font-mono text-sm text-gray-700 dark:text-gray-300">${
            coin.symbol
          }</td>
          <td class="py-4 px-3 text-right font-mono text-gray-900 dark:text-gray-100">$${formatPrice(
            coin.price
          )}</td>
          <td class="py-4 px-3 text-right font-medium ${changeColor}">${changeSign}${change24h.toFixed(
          2
        )}%</td>
          <td class="py-4 px-3 text-right text-gray-700 dark:text-gray-300">$${formatVolume(
            coin.volume
          )}</td>
          <td class="py-4 px-3 text-right text-gray-700 dark:text-gray-300">$${formatMarketCap(
            estimatedMarketCap
          )}</td>
          <td class="py-4 px-3 text-center">
            <div class="w-12 h-6 bg-gradient-to-r from-green-400 to-blue-500 rounded text-xs flex items-center justify-center text-white">
              📈
            </div>
          </td>
        </tr>
      `;
      })
      .join("");

    // Update pagination info
    const totalEl = document.getElementById("marketcap-total");
    const startEl = document.getElementById("marketcap-showing-start");
    const endEl = document.getElementById("marketcap-showing-end");

    if (totalEl) totalEl.textContent = coins.length;
    if (startEl) startEl.textContent = "1";
    if (endEl) startEl.textContent = coins.length;
  }
}
