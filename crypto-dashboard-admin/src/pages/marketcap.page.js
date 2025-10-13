/**
 * Market Cap Page Module
 */
import { ApiService } from "../services/api.service.js";

export class MarketCapPage {
  constructor() {
    this.apiService = new ApiService();
    this.isActive = false;
  }

  async initialize() {
    console.log("🪙 Initializing Market Cap page...");
    this.isActive = true;

    // Setup refresh button
    const refreshBtn = document.getElementById("refresh-marketcap");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        await this.loadMarketCapData();
      });
    }

    // Load initial data
    await this.loadMarketCapData();
  }

  destroy() {
    console.log("🧹 Destroying Market Cap page...");
    this.isActive = false;
  }

  async loadMarketCapData() {
    try {
      const marketCapData = await this.apiService.fetchMarketCap();

      if (marketCapData?.success) {
        this.updateMarketCapPageData(marketCapData);
        this.updateMarketCapTable(marketCapData.data || []);
      } else {
        // Generate mock data if API fails
        const mockData = this.generateMockMarketCapData();
        this.updateMarketCapPageData(mockData);
        this.updateMarketCapTable(mockData.data);
      }

      // Update last update timestamp
      const lastUpdateEl = document.getElementById("marketcap-last-update");
      if (lastUpdateEl) {
        lastUpdateEl.textContent = new Date().toLocaleTimeString();
      }
    } catch (error) {
      console.error("❌ Error loading market cap data:", error);

      // Fallback to mock data
      const mockData = this.generateMockMarketCapData();
      this.updateMarketCapPageData(mockData);
      this.updateMarketCapTable(mockData.data);
    }
  }

  generateMockMarketCapData() {
    const coins = [
      {
        name: "Bitcoin",
        symbol: "BTC",
        price: 67234.56,
        change24h: 2.34,
        volume24h: 28567890123,
        marketCap: 1324567890123,
      },
      {
        name: "Ethereum",
        symbol: "ETH",
        price: 3456.78,
        change24h: -1.23,
        volume24h: 12345678901,
        marketCap: 415678901234,
      },
      {
        name: "Binance Coin",
        symbol: "BNB",
        price: 456.78,
        change24h: 5.67,
        volume24h: 2345678901,
        marketCap: 67890123456,
      },
      {
        name: "Cardano",
        symbol: "ADA",
        price: 0.4567,
        change24h: -3.45,
        volume24h: 1234567890,
        marketCap: 15678901234,
      },
      {
        name: "Solana",
        symbol: "SOL",
        price: 123.45,
        change24h: 8.9,
        volume24h: 3456789012,
        marketCap: 54321098765,
      },
    ];

    const totalMarketCap = coins.reduce((sum, coin) => sum + coin.marketCap, 0);
    const totalVolume = coins.reduce((sum, coin) => sum + coin.volume24h, 0);
    const btcDominance = ((coins[0].marketCap / totalMarketCap) * 100).toFixed(
      1
    );

    return {
      success: true,
      data: coins.map((coin, index) => ({ ...coin, rank: index + 1 })),
      summary: {
        totalMarketCap,
        totalVolume,
        btcDominance,
        activeCoins: coins.length,
      },
    };
  }

  updateMarketCapPageData(data) {
    if (!data.summary) return;

    const formatCurrency = (value) => {
      if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
      if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
      if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
      return `$${value.toLocaleString()}`;
    };

    const elements = {
      "total-market-cap": formatCurrency(data.summary.totalMarketCap),
      "total-volume": formatCurrency(data.summary.totalVolume),
      "btc-dominance": `${data.summary.btcDominance}%`,
      "active-coins": data.summary.activeCoins.toLocaleString(),
    };

    Object.entries(elements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });

    // Update BTC dominance bar
    const dominanceBar = document.getElementById("btc-dominance-bar");
    if (dominanceBar) {
      dominanceBar.style.width = `${data.summary.btcDominance}%`;
    }
  }

  updateMarketCapTable(coins) {
    const tableBody = document.getElementById("marketcap-table-body");
    if (!tableBody) return;

    tableBody.innerHTML = coins
      .map((coin) => {
        const changeColor =
          coin.change24h >= 0 ? "text-green-600" : "text-red-600";
        const changeSign = coin.change24h >= 0 ? "+" : "";

        return `
        <tr class="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
          <td class="py-4 px-3 font-medium">${coin.rank}</td>
          <td class="py-4 px-3">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                ${coin.symbol.charAt(0)}
              </div>
              <span class="font-medium">${coin.name}</span>
            </div>
          </td>
          <td class="py-4 px-3 text-center font-mono text-sm">${
            coin.symbol
          }</td>
          <td class="py-4 px-3 text-right font-mono">$${coin.price.toLocaleString()}</td>
          <td class="py-4 px-3 text-right font-medium ${changeColor}">${changeSign}${coin.change24h.toFixed(
          2
        )}%</td>
          <td class="py-4 px-3 text-right">$${(coin.volume24h / 1e9).toFixed(
            2
          )}B</td>
          <td class="py-4 px-3 text-right">$${(coin.marketCap / 1e9).toFixed(
            2
          )}B</td>
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
    if (endEl) endEl.textContent = coins.length;
  }
}
