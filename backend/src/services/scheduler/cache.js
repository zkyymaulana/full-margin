// Cache untuk menyimpan simbol aktif agar tidak fetch berulang.
let symbolsCache = [];
let symbolsCacheTime = 0;

// TTL cache = 5 menit
export const SYMBOLS_CACHE_TTL = 5 * 60 * 1000;

// Refresh cache simbol dari database/service.
export async function refreshSymbolsCache(getActiveSymbols) {
  symbolsCache = await getActiveSymbols(); // Ambil simbol terbaru.
  symbolsCacheTime = Date.now(); // Simpan waktu refresh.
  console.log(`Symbols cache refreshed (${symbolsCache.length})`);
}

// Ambil data cache simbol saat ini.
export function getSymbolsCache() {
  return symbolsCache;
}

// Cek apakah cache sudah kedaluwarsa.
export function isCacheExpired() {
  return Date.now() - symbolsCacheTime > SYMBOLS_CACHE_TTL;
}
