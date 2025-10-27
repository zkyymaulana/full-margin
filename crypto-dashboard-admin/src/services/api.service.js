/**
 * API Service Module - React version with Axios
 * Centralized API management
 */
import axios from "axios";

const API_BASE_URL = "http://localhost:8000/api";

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
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

// Response interceptor - handle 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = "/login";
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

// Indicator (single)
export const fetchIndicator = async (symbol = "BTC-USD") => {
  const { data } = await apiClient.get(`/indicator/${symbol}`);
  return data;
};

// Multi-indicator
export const fetchMultiIndicator = async (symbol = "BTC-USD") => {
  const { data } = await apiClient.post(
    `/multiIndicator/${symbol}/optimize-weights`,
    {},
    {
      timeout: 15000,
    }
  );
  return data;
};

// Candlestick data
export const fetchCandles = async (symbol = "BTC-USD", timeframe = "1h") => {
  const { data } = await apiClient.get(`/chart/${symbol}`, {
    params: { timeframe },
    timeout: 10000,
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

// Comparison (custom body)
export const fetchComparison = async (requestBody) => {
  const { data } = await apiClient.post("/comparison/compare", requestBody, {
    timeout: 30000,
  });
  return data;
};

// Quick comparison (preset)
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
      timeout: 20000,
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

// Update signal mode
export const updateSignalMode = async (mode) => {
  const { data } = await apiClient.post("/telegram/signal-mode", { mode });
  return data;
};

// Test Telegram connection
export const testTelegramConnection = async () => {
  const { data } = await apiClient.get("/telegram/test");
  return data;
};

export default apiClient;
