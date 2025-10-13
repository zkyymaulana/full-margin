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

  async fetchAnalysis(symbol = "BTC-USD") {
    return this.fetchWithCache(
      `${this.baseURL}/analysis/${symbol}`,
      `analysis_${symbol}`
    );
  }

  async fetchCandles(symbol = "BTC-USD", timeframe = "1h") {
    return this.fetchWithCache(
      `${this.baseURL}/chart/${symbol}?timeframe=${timeframe}`,
      `candles_${symbol}_${timeframe}`
    );
  }

  async fetchMarketCap() {
    return this.fetchWithCache(`${this.baseURL}/marketcap`, "marketcap");
  }

  async fetchSignals() {
    return this.fetchWithCache(`${this.baseURL}/signals`, "signals");
  }

  async fetchIndicators(symbol = "BTC-USD") {
    return this.fetchWithCache(
      `${this.baseURL}/indicators/${symbol}`,
      `indicators_${symbol}`
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
