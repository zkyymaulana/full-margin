// Barrel file hooks dengan explicit named exports.
// Format ini memudahkan impor terpusat dan tetap jelas asal fungsinya.

export {
  useLogin, // Hook login user
  useRegister, // Hook registrasi user
  useLogout, // Hook logout user
  useAuth, // Hook cek status autentikasi
} from "./useAuth";

export {
  useCandles, // Hook ambil data candle
  useCandlesPaginated, // Hook candle dengan pagination
} from "./useCandles";

export {
  useChartPagination, // Hook infinite scroll chart
} from "./useChartPagination";

export {
  useChartSync, // Hook sinkronisasi antar chart
} from "./useChartSync";

export {
  useComparison, // Hook comparison custom
  useQuickComparison, // Hook quick comparison preset
  useLastComparison, // Hook baca cache comparison terakhir
} from "./useComparison";

export {
  useIndicator, // Hook indikator endpoint terpadu
  useMultiIndicator, // Hook lama (deprecated) untuk kompatibilitas
} from "./useIndicators";

export {
  useMarketCapLive, // Hook marketcap live
  useMarketCapSummary, // Hook ringkasan marketcap
  useMarketcapSymbols, // Hook daftar simbol marketcap
} from "./useMarketcap";

export {
  useCryptoWebSocket, // Hook websocket harga crypto
} from "./useCryptoWebSocket";

export {
  useOptimization, // Hook jalankan optimasi
  useOptimizationEstimate, // Hook estimasi durasi optimasi
  useOptimizationProgress, // Hook progres optimasi via SSE
} from "./useOptimization";

export {
  useUserProfile, // Hook ambil profil user
  useUpdateProfile, // Hook update profil user
} from "./useUser";

export {
  useWatchlist, // Hook kelola watchlist user
} from "./useWatchlist";
