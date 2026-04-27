// Cache untuk menyimpan symbol aktif agar tidak fetch berulang-ulang
let symbolsCache = [];
let symbolsCacheTime = 0;

// TTL cache = 5 menit
export const SYMBOLS_CACHE_TTL = 5 * 60 * 1000;

// Refresh cache symbol dari database/service
export async function refreshSymbolsCache(getActiveSymbols) {
  symbolsCache = await getActiveSymbols(); // ambil symbol terbaru
  symbolsCacheTime = Date.now(); // simpan waktu refresh
  console.log(`Symbols cache refreshed (${symbolsCache.length})`);
}

// Ambil data cache symbol saat ini
export function getSymbolsCache() {
  return symbolsCache;
}

// Cek apakah cache sudah expired
export function isCacheExpired() {
  return Date.now() - symbolsCacheTime > SYMBOLS_CACHE_TTL;
}
