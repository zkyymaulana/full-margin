// Modul service API frontend berbasis Axios.
// Semua request HTTP dikumpulkan di sini agar pemakaian di komponen lebih rapi.
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Konfigurasi instance Axios global.
// Timeout default dibuat panjang karena ada proses backend yang berat (analisis/backtest).
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Sisipkan header Authorization tanpa interceptor agar message error tetap dari backend.
const withAuthConfig = (config = {}) => {
  const token = localStorage.getItem("authToken");
  if (!token) return config;

  return {
    ...config,
    headers: {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  };
};

const get = (url, config = {}) => apiClient.get(url, withAuthConfig(config));
const post = (url, body = {}, config = {}) =>
  apiClient.post(url, body, withAuthConfig(config));
const put = (url, body = {}, config = {}) =>
  apiClient.put(url, body, withAuthConfig(config));
const patch = (url, body = {}, config = {}) =>
  apiClient.patch(url, body, withAuthConfig(config));
const del = (url, config = {}) => apiClient.delete(url, withAuthConfig(config));

// ==============================
// API Methods - Market & Chart
// ==============================

// Ambil daftar simbol marketcap untuk dropdown pencarian.
export const getMarketcapSymbols = async () => {
  const { data } = await get("/marketcap/symbol");
  return data?.symbols || [];
};

// Ambil data indikator dari endpoint terpadu (mendukung mode latest/paginated).
export const fetchIndicator = async (
  symbol = "BTC-USD",
  mode = "latest",
  timeframe = "1h",
) => {
  const { data } = await get(`/indicator/${symbol}`, {
    params: { mode, timeframe },
  });
  return data;
};

// Deprecated: dipertahankan untuk kompatibilitas impor lama.
export const fetchMultiIndicator = async (symbol = "BTC-USD") => {
  console.warn(
    "⚠️ fetchMultiIndicator is deprecated. Use fetchIndicator with mode=latest instead.",
  );
  // Alihkan ke endpoint baru agar perilaku tetap konsisten.
  return fetchIndicator(symbol, "latest", "1h");
};

// Ambil data candlestick standar.
export const fetchCandles = async (symbol = "BTC-USD", timeframe = "1h") => {
  const { data } = await get(`/chart/${symbol}`, {
    params: { timeframe },
    timeout: 10000,
  });
  return data;
};

// Ambil data candlestick dengan dukungan pagination.
export const fetchCandlesWithPagination = async (
  symbol = "BTC-USD",
  timeframe = "1h",
  page = 1,
  limit = 1000,
) => {
  const { data } = await get(`/chart/${symbol}`, {
    params: { timeframe, page, limit },
    timeout: 10000,
  });
  return data;
};

// Ambil harga live ringan untuk satu simbol chart.
export const fetchChartLiveTicker = async (symbol = "BTC-USD") => {
  const { data } = await get(`/chart/${symbol}/live`, {
    timeout: 10000,
  });
  return data;
};

// Ambil OHLCV live per timeframe langsung dari endpoint chart.
export const fetchChartLiveOHLCV = async (
  symbol = "BTC-USD",
  timeframe = "1h",
) => {
  const { data } = await get(`/chart/${symbol}/live-ohlcv`, {
    params: { timeframe },
    timeout: 10000,
  });
  return data;
};

// Ambil data candle dari URL pagination full (next/prev).
export const fetchCandlesByUrl = async (url, signal = null) => {
  // apiClient sudah punya baseURL, jadi URL absolut harus dipotong ke path relatif.

  // Parse URL penuh dari pagination response backend.
  const parsedUrl = new URL(url);

  // Hapus prefix /api agar cocok dengan baseURL apiClient.
  const pathWithoutApi = parsedUrl.pathname.replace("/api", "");

  // Ambil query string (page, limit, dll).
  const queryString = parsedUrl.search;

  // Gabungkan path dan query menjadi endpoint final.
  const finalPath = pathWithoutApi + queryString;

  // Token auth ditambahkan oleh helper withAuthConfig.
  const { data } = await get(finalPath, {
    timeout: 10000,
    signal, // ✅ Support AbortController signal
  });

  return data;
};

// Ambil marketcap live (default 20 coin dari backend).
export const fetchMarketCapLive = async () => {
  const { data } = await get("/marketcap/live", {
    timeout: 60000,
  });
  return data;
};

// Jalankan comparison custom body (proses berat, timeout panjang).
export const fetchComparison = async (requestBody) => {
  const { data } = await post("/comparison/compare", requestBody, {
    timeout: 120000, // ✅ 2 minutes for backtesting analysis
  });
  return data;
};

// Jalankan quick comparison berbasis preset (proses berat, timeout panjang).
export const fetchQuickComparison = async (
  symbol,
  preset = "balanced",
  days = 30,
) => {
  const { data } = await post(
    "/comparison/quick",
    {
      symbol,
      preset,
      days,
    },
    {
      timeout: 120000, // ✅ 2 minutes for backtesting analysis
    },
  );
  return data;
};

// Login pengguna.
export const login = async (email, password) => {
  const { data } = await post("/auth/login", { email, password });
  return data;
};

// Registrasi pengguna.
export const register = async (email, password, name) => {
  const { data } = await post("/auth/register", {
    email,
    password,
    name,
  });
  return data;
};

// Logout sesi aktif.
export const logout = async () => {
  const { data } = await post("/auth/logout", {});
  return data;
};

// Ambil profil user yang sedang login.
export const getUserProfile = async () => {
  const { data } = await get("/user/profile");
  return data;
};

// Perbarui data profil user.
export const updateUserProfile = async (profileData) => {
  const { data } = await put("/user/profile", profileData);
  return data;
};

// Ganti password user.
export const changeUserPassword = async (passwordData) => {
  const { data } = await put("/user/profile", passwordData);
  return data;
};

// ============================
// API Methods - Telegram
// ============================

// Ambil konfigurasi telegram user.
export const getTelegramConfig = async () => {
  const { data } = await get("/telegram/config");
  return data;
};

// Aktif/nonaktif notifikasi telegram.
export const toggleTelegram = async (enabled) => {
  const { data } = await post("/telegram/toggle", { enabled });
  return data;
};

// Uji koneksi telegram.
export const testTelegramConnection = async () => {
  const { data } = await get("/telegram/test");
  return data;
};

// Perbarui pengaturan telegram per user.
export const updateUserTelegramSettings = async (userId, settings) => {
  const { data } = await patch(`/user/${userId}/telegram`, settings);
  return data;
};

// Ambil profil user termasuk info telegram.
export const getUserTelegramInfo = async () => {
  const { data } = await get("/user/profile");
  return data;
};

// =========================================
// API Methods - Multi-Indicator Optimization
// =========================================

// Minta proses optimasi bobot indikator (full/incremental dipilih backend).
export const requestOptimization = async (
  symbol = "BTC-USD",
  timeframe = "1h",
) => {
  const { data } = await post(
    `/multiIndicator/${symbol}/optimize-weights`,
    {},
    {
      params: { timeframe },
      timeout: 7200000, // 2 jam: antisipasi proses exhaustive yang panjang.
    },
  );
  return data;
};

// Paksa re-optimasi penuh meskipun bobot sebelumnya sudah ada.
export const forceReoptimization = async (
  symbol = "BTC-USD",
  timeframe = "1h",
) => {
  const { data } = await post(
    `/multiIndicator/${symbol}/optimize-weights`,
    { force: true },
    {
      params: { timeframe },
      timeout: 3600000, // 60 menit untuk mode full.
    },
  );
  return data;
};

// Ambil estimasi waktu optimasi untuk simbol dan timeframe tertentu.
export const getOptimizationEstimate = async (
  symbol = "BTC-USD",
  timeframe = "1h",
) => {
  const { data } = await get(`/multiIndicator/${symbol}/estimate`, {
    params: { timeframe },
    timeout: 10000,
  });
  return data;
};

// Ambil status job optimasi untuk fallback polling saat SSE terputus.
export const getOptimizationStatus = async (symbol = "BTC-USD") => {
  const { data } = await get(`/multiIndicator/${symbol}/status`, {
    timeout: 10000,
  });
  return data;
};

// Batalkan job optimasi yang sedang berjalan.
export const cancelOptimization = async (symbol) => {
  const { data } = await post(`/multiIndicator/${symbol}/cancel`);
  return data;
};

// ============================
// API Methods - Watchlist
// ============================

// Ambil watchlist milik user saat ini.
export const getWatchlist = async () => {
  const { data } = await get("/watchlist");
  return data;
};

// Tambahkan coin ke watchlist.
export const addToWatchlist = async (coinId) => {
  const { data } = await post("/watchlist", { coinId });
  return data;
};

// Hapus coin dari watchlist.
export const removeFromWatchlist = async (coinId) => {
  const { data } = await del(`/watchlist/${coinId}`);
  return data;
};

export default apiClient;
