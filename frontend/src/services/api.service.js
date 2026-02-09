/**
 * API Service Module - React version with Axios
 * Centralized API management
 */
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// =====================================================
// 🔧 AXIOS CONFIGURATION
// =====================================================

/**
 * Global Axios Instance with Extended Timeout
 *
 * Default timeout: 120000ms (2 minutes)
 * Suitable for heavy backend processes like backtesting and analysis
 *
 * Per-request timeout override example:
 * apiClient.get('/endpoint', { timeout: 60000 })
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle 401 and 403 token errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log(
      "🔍 API Error intercepted:",
      error.response?.status,
      error.response?.data
    );

    // Handle 401 Unauthorized OR 403 Forbidden (token errors)
    const status = error.response?.status;
    const errorMessage = error.response?.data?.message || "";
    const errorSuccess = error.response?.data?.success;

    // Check if it's 401 or 403 with token error
    if (status === 401 || status === 403) {
      console.log(`🚨 ${status} Error detected:`, errorMessage);

      // Check if error is related to invalid or expired token
      const isTokenError =
        errorSuccess === false &&
        (errorMessage.includes("Token tidak valid") ||
          errorMessage.includes("sudah kadaluarsa") ||
          errorMessage.includes("Unauthorized") ||
          errorMessage.includes("Forbidden") ||
          errorMessage.includes("Invalid token") ||
          errorMessage.includes("Token expired") ||
          errorMessage.includes("tidak valid") ||
          errorMessage.includes("kadaluarsa") ||
          errorMessage.toLowerCase().includes("token"));

      if (isTokenError) {
        console.log("🔒 Token invalid or expired. Logging out...");
        console.log("🧹 Clearing localStorage...");

        // Clear all auth data immediately
        localStorage.removeItem("authToken");
        localStorage.removeItem("userId");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userName");
        localStorage.removeItem("user");
        localStorage.removeItem("lastLogin");

        console.log("✅ localStorage cleared");

        // Show notification
        const toastElement = document.createElement("div");
        toastElement.className =
          "fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-[9999] flex items-center gap-2 animate-pulse";
        toastElement.innerHTML = `
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
          <span><strong>Session Expired!</strong> Redirecting to login...</span>
        `;
        document.body.appendChild(toastElement);

        console.log("🔄 Redirecting to login page in 1 second...");

        // Force redirect to login immediately
        setTimeout(() => {
          toastElement.remove();
          console.log("🚀 Executing redirect now...");

          // Multiple redirect methods to ensure it works
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";

            // Fallback if href doesn't work
            setTimeout(() => {
              window.location.replace("/login");
            }, 100);
          }
        }, 1000);

        // Prevent further API calls
        return Promise.reject({
          ...error,
          handled: true,
          message: "Session expired. Redirecting to login...",
        });
      }
    }

    return Promise.reject(error);
  }
);

// =====================================================
// 📊 API METHODS
// =====================================================

// Marketcap symbols (for search dropdown)
export const getMarketcapSymbols = async () => {
  const { data } = await apiClient.get("/marketcap/symbol");
  return data?.symbols || [];
};

// Indicator (single) - Unified endpoint with mode support
export const fetchIndicator = async (
  symbol = "BTC-USD",
  mode = "latest",
  timeframe = "1h"
) => {
  const { data } = await apiClient.get(`/indicator/${symbol}`, {
    params: { mode, timeframe },
  });
  return data;
};

// ❌ DEPRECATED: Multi-indicator (replaced by fetchIndicator with mode=latest)
// Keep for backward compatibility but not used anymore
export const fetchMultiIndicator = async (symbol = "BTC-USD") => {
  console.warn(
    "⚠️ fetchMultiIndicator is deprecated. Use fetchIndicator with mode=latest instead."
  );
  // Redirect to new endpoint
  return fetchIndicator(symbol, "latest", "1h");
};

// Candlestick data
export const fetchCandles = async (symbol = "BTC-USD", timeframe = "1h") => {
  const { data } = await apiClient.get(`/chart/${symbol}`, {
    params: { timeframe },
    timeout: 10000,
  });
  return data;
};

// Candlestick data with pagination support
export const fetchCandlesWithPagination = async (
  symbol = "BTC-USD",
  timeframe = "1h",
  page = 1,
  limit = 1000
) => {
  const { data } = await apiClient.get(`/chart/${symbol}`, {
    params: { timeframe, page, limit },
    timeout: 10000,
  });
  return data;
};

// Fetch candles by full URL (for pagination next/prev)
export const fetchCandlesByUrl = async (url, signal = null) => {
  // ✅ FIX: Remove base URL to work with apiClient
  // Full URL example: http://localhost:8000/api/chart/BTC-USD?page=2&limit=1000
  // We need: /chart/BTC-USD?page=2&limit=1000

  // Parse the URL
  const parsedUrl = new URL(url);

  // Get the path without '/api' prefix
  // Example: /api/chart/BTC-USD → /chart/BTC-USD
  const pathWithoutApi = parsedUrl.pathname.replace("/api", "");

  // Get query parameters
  // Example: ?page=2&limit=1000
  const queryString = parsedUrl.search;

  // Combine path + query
  const finalPath = pathWithoutApi + queryString;

  // Make request with auth token (automatically added by apiClient)
  const { data } = await apiClient.get(finalPath, {
    timeout: 10000,
    signal, // ✅ Support AbortController signal
  });

  return data;
};

// Marketcap live
export const fetchMarketCapLive = async (limit = 100) => {
  const { data } = await apiClient.get("/marketcap/live", {
    params: { limit },
    timeout: 60000,
  });
  return data;
};

// Comparison (custom body) - Heavy process requiring extended timeout
export const fetchComparison = async (requestBody) => {
  const { data } = await apiClient.post("/comparison/compare", requestBody, {
    timeout: 120000, // ✅ 2 minutes for backtesting analysis
  });
  return data;
};

// Quick comparison (preset) - Heavy process requiring extended timeout
export const fetchQuickComparison = async (
  symbol,
  preset = "balanced",
  days = 30
) => {
  const { data } = await apiClient.post(
    "/comparison/quick",
    {
      symbol,
      preset,
      days,
    },
    {
      timeout: 120000, // ✅ 2 minutes for backtesting analysis
    }
  );
  return data;
};

// Auth - Login
export const login = async (email, password) => {
  const { data } = await apiClient.post("/auth/login", { email, password });
  return data;
};

// Auth - Register
export const register = async (email, password, name) => {
  const { data } = await apiClient.post("/auth/register", {
    email,
    password,
    name,
  });
  return data;
};

// Auth - Logout
export const logout = async () => {
  const { data } = await apiClient.post("/auth/logout");
  return data;
};

// User Profile - Get profile
export const getUserProfile = async () => {
  const { data } = await apiClient.get("/user/profile");
  return data;
};

// User Profile - Update profile
export const updateUserProfile = async (profileData) => {
  const { data } = await apiClient.put("/user/profile", profileData);
  return data;
};

// User Profile - Change password
export const changeUserPassword = async (passwordData) => {
  const { data } = await apiClient.put("/user/profile", passwordData);
  return data;
};

// =====================================================
// 📱 TELEGRAM API METHODS
// =====================================================

// Get Telegram configuration
export const getTelegramConfig = async () => {
  const { data } = await apiClient.get("/telegram/config");
  return data;
};

// Toggle Telegram notifications
export const toggleTelegram = async (enabled) => {
  const { data } = await apiClient.post("/telegram/toggle", { enabled });
  return data;
};

// Test Telegram connection
export const testTelegramConnection = async () => {
  const { data } = await apiClient.get("/telegram/test");
  return data;
};

// ✅ NEW: Update user Telegram settings (Multi-User)
export const updateUserTelegramSettings = async (userId, settings) => {
  const { data } = await apiClient.patch(`/user/${userId}/telegram`, settings);
  return data;
};

// ✅ NEW: Get user profile with Telegram info
export const getUserTelegramInfo = async () => {
  const { data } = await apiClient.get("/user/profile");
  return data;
};

export default apiClient;
