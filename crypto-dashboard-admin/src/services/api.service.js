/**
 * API Service Module - Centralized API management with authentication
 */
export class ApiService {
  constructor() {
    this.baseURL = "http://localhost:8000/api";
    this.cache = new Map();
    this.cacheDuration = 4000; // 4 seconds
  }

  /**
   * Get authorization headers
   */
  getAuthHeaders() {
    const token = localStorage.getItem("authToken");
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  async fetchWithCache(url, cacheKey) {
    const now = Date.now();
    const cached = this.cache.get(cacheKey);

    if (cached && now - cached.timestamp < this.cacheDuration) {
      console.log(`📦 Using cached data for ${cacheKey}`);
      return cached.data;
    }

    try {
      console.log(`🌐 Fetching fresh data from ${url}`);
      const response = await fetch(url, {
        method: "GET",
        headers: this.getAuthHeaders(),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.status === 401) {
        // Unauthorized - redirect to login
        console.log("🔒 Unauthorized access, redirecting to login...");
        localStorage.removeItem("authToken");
        localStorage.removeItem("userId");
        localStorage.removeItem("userEmail");
        window.location.href = "/src/pages/login.html";
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`✅ Data fetched successfully for ${cacheKey}:`, data);
      this.cache.set(cacheKey, { data, timestamp: now });
      return data;
    } catch (error) {
      console.error(`❌ Error fetching ${cacheKey}:`, error);
      return cached ? cached.data : null; // Return cached data if available
    }
  }

  async fetchIndicator(symbol = "BTC-USD") {
    return this.fetchWithCache(
      `${this.baseURL}/indicator/${symbol}`,
      `indicator_${symbol}`
    );
  }

  async fetchMultiIndicator(symbol = "BTC-USD") {
    try {
      const cacheKey = `multi_indicator_${symbol}`;
      const now = Date.now();
      const cached = this.cache.get(cacheKey);

      if (cached && now - cached.timestamp < this.cacheDuration) {
        console.log(`📦 Using cached multi-indicator data for ${cacheKey}`);
        return cached.data;
      }

      console.log(
        `🌐 Fetching fresh multi-indicator data from ${this.baseURL}/multiIndicator/${symbol}`
      );
      const response = await fetch(`${this.baseURL}/multiIndicator/${symbol}`, {
        method: "GET",
        headers: this.getAuthHeaders(),
        signal: AbortSignal.timeout(15000), // 15 second timeout for multi-indicator
      });

      if (response.status === 401) {
        console.log("🔒 Unauthorized access, redirecting to login...");
        localStorage.removeItem("authToken");
        localStorage.removeItem("userId");
        localStorage.removeItem("userEmail");
        window.location.href = "/src/pages/login.html";
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(
        `✅ Multi-indicator data fetched successfully for ${cacheKey}:`,
        data
      );
      this.cache.set(cacheKey, { data, timestamp: now });
      return data;
    } catch (error) {
      console.error(`❌ Error fetching multi-indicator ${symbol}:`, error);
      const cached = this.cache.get(`multi_indicator_${symbol}`);
      return cached ? cached.data : null;
    }
  }

  async fetchCandles(symbol = "BTC-USD", timeframe = "1h") {
    return this.fetchWithCache(
      `${this.baseURL}/chart/${symbol}?timeframe=${timeframe}`,
      `candles_${symbol}_${timeframe}`
    );
  }

  async fetchMarketCap() {
    return this.fetchWithCache(
      `${this.baseURL}/marketcap/live`,
      "marketcap_live"
    );
  }

  async fetchMarketCapLive() {
    return this.fetchWithCache(
      `${this.baseURL}/marketcap/live`,
      "marketcap_live"
    );
  }

  async fetchSignals() {
    return this.fetchWithCache(`${this.baseURL}/signals`, "signals");
  }

  async fetchComparison(requestBody) {
    try {
      console.log(`🔍 Fetching comparison data:`, requestBody);
      const response = await fetch(`${this.baseURL}/comparison/compare`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30000), // 30 second timeout for comparisons
      });

      if (response.status === 401) {
        // Unauthorized - redirect to login
        console.log("🔒 Unauthorized access, redirecting to login...");
        localStorage.removeItem("authToken");
        localStorage.removeItem("userId");
        localStorage.removeItem("userEmail");
        window.location.href = "/src/pages/login.html";
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();
      console.log(`✅ Comparison data fetched successfully:`, data);
      return data;
    } catch (error) {
      console.error(`❌ Error fetching comparison:`, error);
      throw error;
    }
  }

  async fetchQuickComparison(symbol, preset = "balanced", days = 30) {
    try {
      console.log(`🚀 Fetching quick comparison: ${symbol} - ${preset}`);
      const response = await fetch(`${this.baseURL}/comparison/quick`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ symbol, preset, days }),
        signal: AbortSignal.timeout(20000), // 20 second timeout
      });

      if (response.status === 401) {
        localStorage.clear();
        window.location.href = "/src/pages/login.html";
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();
      console.log(`✅ Quick comparison completed:`, data);
      return data;
    } catch (error) {
      console.error(`❌ Error in quick comparison:`, error);
      throw error;
    }
  }

  async fetchAvailableIndicators(symbol = "BTC-USD") {
    return this.fetchWithCache(
      `${this.baseURL}/comparison/indicators/${symbol}`,
      `available_indicators_${symbol}`
    );
  }

  async fetchComparisonStats() {
    return this.fetchWithCache(
      `${this.baseURL}/comparison/stats`,
      "comparison_stats"
    );
  }

  clearCache() {
    this.cache.clear();
    console.log("🧹 API cache cleared");
  }

  setCacheDuration(duration) {
    this.cacheDuration = duration;
  }
}
