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

// Interceptor request: sisipkan token auth bila tersedia.
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
  },
);

// Interceptor response: tangani error token (401/403) secara terpusat.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Tangani error jaringan/timeout tanpa membanjiri log.
    if (!error.response) {
      // Kondisi: jaringan putus, timeout, atau server tidak merespons.
      if (error.code === "ECONNABORTED") {
        // Timeout dibiarkan ditangani caller agar UI bisa menentukan respons.
        return Promise.reject(error);
      }
      if (error.message === "Network Error") {
        console.error("🌐 Network Error: Server tidak dapat dijangkau");
        return Promise.reject(error);
      }
      // Error lain tanpa response (contoh: request dibatalkan).
      return Promise.reject(error);
    }

    // Log detail hanya jika server memberi response.
    const status = error.response.status;
    const errorMessage = error.response.data?.message || "";
    const errorSuccess = error.response.data?.success;

    console.log("🔍 API Error intercepted:", status, errorMessage);

    // Tangani 401/403 yang berkaitan dengan token.
    if (status === 401 || status === 403) {
      console.log(`🚨 ${status} Error detected:`, errorMessage);

      // Deteksi berbagai pesan error token tidak valid/kadaluarsa.
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

        // Hapus data autentikasi lokal agar sesi benar-benar bersih.
        localStorage.removeItem("authToken");
        localStorage.removeItem("userId");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userName");
        localStorage.removeItem("user");
        localStorage.removeItem("lastLogin");

        console.log("✅ localStorage cleared");

        // Tampilkan notifikasi singkat sebelum redirect.
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

        // Redirect paksa ke halaman login.
        setTimeout(() => {
          toastElement.remove();
          console.log("🚀 Executing redirect now...");

          // Gunakan fallback redirect untuk berjaga-jaga jika metode pertama gagal.
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";

            // Fallback if href doesn't work
            setTimeout(() => {
              window.location.replace("/login");
            }, 100);
          }
        }, 1000);

        // Tandai error sudah ditangani agar alur atas bisa mengenali status ini.
        return Promise.reject({
          ...error,
          handled: true,
          message: "Session expired. Redirecting to login...",
        });
      }
    }

    return Promise.reject(error);
  },
);

// ==============================
// API Methods - Market & Chart
// ==============================

// Ambil daftar simbol marketcap untuk dropdown pencarian.
export const getMarketcapSymbols = async () => {
  const { data } = await apiClient.get("/marketcap/symbol");
  return data?.symbols || [];
};

// Ambil data indikator dari endpoint terpadu (mendukung mode latest/paginated).
export const fetchIndicator = async (
  symbol = "BTC-USD",
  mode = "latest",
  timeframe = "1h",
) => {
  const { data } = await apiClient.get(`/indicator/${symbol}`, {
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
  const { data } = await apiClient.get(`/chart/${symbol}`, {
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
  const { data } = await apiClient.get(`/chart/${symbol}`, {
    params: { timeframe, page, limit },
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

  // Token auth ditambahkan otomatis oleh interceptor request.
  const { data } = await apiClient.get(finalPath, {
    timeout: 10000,
    signal, // ✅ Support AbortController signal
  });

  return data;
};

// Ambil marketcap live (default 20 coin dari backend).
export const fetchMarketCapLive = async () => {
  const { data } = await apiClient.get("/marketcap/live", {
    timeout: 60000,
  });
  return data;
};

// Jalankan comparison custom body (proses berat, timeout panjang).
export const fetchComparison = async (requestBody) => {
  const { data } = await apiClient.post("/comparison/compare", requestBody, {
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
  const { data } = await apiClient.post(
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
  const { data } = await apiClient.post("/auth/login", { email, password });
  return data;
};

// Registrasi pengguna.
export const register = async (email, password, name) => {
  const { data } = await apiClient.post("/auth/register", {
    email,
    password,
    name,
  });
  return data;
};

// Logout sesi aktif.
export const logout = async () => {
  const { data } = await apiClient.post("/auth/logout");
  return data;
};

// Ambil profil user yang sedang login.
export const getUserProfile = async () => {
  const { data } = await apiClient.get("/user/profile");
  return data;
};

// Perbarui data profil user.
export const updateUserProfile = async (profileData) => {
  const { data } = await apiClient.put("/user/profile", profileData);
  return data;
};

// Ganti password user.
export const changeUserPassword = async (passwordData) => {
  const { data } = await apiClient.put("/user/profile", passwordData);
  return data;
};

// ============================
// API Methods - Telegram
// ============================

// Ambil konfigurasi telegram user.
export const getTelegramConfig = async () => {
  const { data } = await apiClient.get("/telegram/config");
  return data;
};

// Aktif/nonaktif notifikasi telegram.
export const toggleTelegram = async (enabled) => {
  const { data } = await apiClient.post("/telegram/toggle", { enabled });
  return data;
};

// Uji koneksi telegram.
export const testTelegramConnection = async () => {
  const { data } = await apiClient.get("/telegram/test");
  return data;
};

// Perbarui pengaturan telegram per user.
export const updateUserTelegramSettings = async (userId, settings) => {
  const { data } = await apiClient.patch(`/user/${userId}/telegram`, settings);
  return data;
};

// Ambil profil user termasuk info telegram.
export const getUserTelegramInfo = async () => {
  const { data } = await apiClient.get("/user/profile");
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
  const { data } = await apiClient.post(
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
  const { data } = await apiClient.post(
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
  const { data } = await apiClient.get(`/multiIndicator/${symbol}/estimate`, {
    params: { timeframe },
    timeout: 10000,
  });
  return data;
};

// Ambil status job optimasi untuk fallback polling saat SSE terputus.
export const getOptimizationStatus = async (symbol = "BTC-USD") => {
  const { data } = await apiClient.get(`/multiIndicator/${symbol}/status`, {
    timeout: 10000,
  });
  return data;
};

// Batalkan job optimasi yang sedang berjalan.
export const cancelOptimization = async (symbol) => {
  const { data } = await apiClient.post(`/multiIndicator/${symbol}/cancel`);
  return data;
};

// ============================
// API Methods - Watchlist
// ============================

// Ambil watchlist milik user saat ini.
export const getWatchlist = async () => {
  const { data } = await apiClient.get("/watchlist");
  return data;
};

// Tambahkan coin ke watchlist.
export const addToWatchlist = async (coinId) => {
  const { data } = await apiClient.post("/watchlist", { coinId });
  return data;
};

// Hapus coin dari watchlist.
export const removeFromWatchlist = async (coinId) => {
  const { data } = await apiClient.delete(`/watchlist/${coinId}`);
  return data;
};

export default apiClient;
