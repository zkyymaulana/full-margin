/**
 * API Service Module (Functional version)
 * Centralized API management with caching and authentication
 */

const API_BASE_URL = "http://localhost:8000/api";
const cache = new Map();
let cacheDuration = 4000; // 4 seconds

// =====================================================
// 🔐 AUTH HEADERS
// =====================================================
function getAuthHeaders() {
  const token = localStorage.getItem("authToken");
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// =====================================================
// 💾 FETCH WITH CACHE
// =====================================================
async function fetchWithCache(url, cacheKey, timeout = 10000) {
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < cacheDuration) {
    console.log(`📦 Using cached data for ${cacheKey}`);
    return cached.data;
  }

  try {
    console.log(`🌐 Fetching fresh data: ${url}`);
    const res = await fetch(url, {
      method: "GET",
      headers: getAuthHeaders(),
      signal: AbortSignal.timeout(timeout),
    });

    if (res.status === 401) {
      console.warn("🔒 Unauthorized, redirecting to login...");
      localStorage.clear();
      window.location.href = "/src/pages/login.html";
      return null;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    cache.set(cacheKey, { data, timestamp: now });
    return data;
  } catch (err) {
    console.error(`❌ Error fetching ${cacheKey}:`, err);
    return cached ? cached.data : null;
  }
}

// =====================================================
// 📊 API CALLS
// =====================================================

// Marketcap symbols (for search dropdown)
export async function getMarketcapSymbols() {
  const data = await fetchWithCache(
    `${API_BASE_URL}/marketcap/symbol`,
    "marketcap_symbols"
  );
  return data?.symbols || [];
}

// Indicator (single)
export async function fetchIndicator(symbol = "BTC-USD") {
  return fetchWithCache(
    `${API_BASE_URL}/indicator/${symbol}`,
    `indicator_${symbol}`
  );
}

// Multi-indicator
export async function fetchMultiIndicator(symbol = "BTC-USD") {
  return fetchWithCache(
    `${API_BASE_URL}/multiIndicator/${symbol}`,
    `multi_indicator_${symbol}`,
    15000
  );
}

// Candlestick data
export async function fetchCandles(symbol = "BTC-USD", timeframe = "1h") {
  return fetchWithCache(
    `${API_BASE_URL}/chart/${symbol}?timeframe=${timeframe}`,
    `candles_${symbol}_${timeframe}`
  );
}

// Marketcap live
export async function fetchMarketCapLive() {
  return fetchWithCache(`${API_BASE_URL}/marketcap/live`, "marketcap_live");
}

// Signals
export async function fetchSignals() {
  return fetchWithCache(`${API_BASE_URL}/signals`, "signals");
}

// Comparison (custom body)
export async function fetchComparison(requestBody) {
  try {
    console.log("🔍 Fetching comparison data:", requestBody);
    const res = await fetch(`${API_BASE_URL}/comparison/compare`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });

    if (res.status === 401) {
      localStorage.clear();
      window.location.href = "/src/pages/login.html";
      return null;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("❌ Error fetching comparison:", err);
    throw err;
  }
}

// Quick comparison (preset)
export async function fetchQuickComparison(
  symbol,
  preset = "balanced",
  days = 30
) {
  try {
    const res = await fetch(`${API_BASE_URL}/comparison/quick`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ symbol, preset, days }),
      signal: AbortSignal.timeout(20000),
    });

    if (res.status === 401) {
      localStorage.clear();
      window.location.href = "/src/pages/login.html";
      return null;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("❌ Error in quick comparison:", err);
    throw err;
  }
}

// Available indicators
export async function fetchAvailableIndicators(symbol = "BTC-USD") {
  return fetchWithCache(
    `${API_BASE_URL}/comparison/indicators/${symbol}`,
    `available_indicators_${symbol}`
  );
}

// Comparison stats
export async function fetchComparisonStats() {
  return fetchWithCache(`${API_BASE_URL}/comparison/stats`, "comparison_stats");
}

// =====================================================
// ⚙️ UTILITIES
// =====================================================
export function clearCache() {
  cache.clear();
  console.log("🧹 API cache cleared");
}

export function setCacheDuration(duration) {
  cacheDuration = duration;
}
