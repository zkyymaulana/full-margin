// src/utils/dataCleaner.js
/** Membersihkan data top coin dari CoinMarketCap */
export function cleanTopCoinData(coins = []) {
  // Validasi awal agar fungsi aman menerima input kosong.
  if (!Array.isArray(coins) || coins.length === 0) return [];

  // Filter hanya data coin yang valid lalu normalisasi format field.
  return (
    coins
      .filter(
        (c) =>
          c &&
          typeof c.symbol === "string" &&
          Number.isInteger(c.rank) &&
          c.rank > 0 &&
          isFinite(c.price) &&
          isFinite(c.marketCap) &&
          c.price > 0 &&
          c.marketCap > 0,
      )
      .map((c) => ({
        rank: c.rank,
        name: c.name || "",
        symbol: c.symbol.toUpperCase(),
        // Batasi desimal agar ukuran payload tetap efisien.
        price: Number(c.price.toFixed(2)),
        marketCap: Number(c.marketCap.toFixed(2)),
        volume24h: c.volume24h ? Number(c.volume24h.toFixed(2)) : 0,
        // Pertahankan metadata tanggal listing bila tersedia.
        listingDate: c.listingDate || null,
        cmcListingDate: c.cmcListingDate || null,
      }))
      // Urutkan berdasarkan rank agar konsisten saat dipakai service.
      .sort((a, b) => a.rank - b.rank)
  );
}

/**
 * Membersihkan data ticker dari Coinbase
 */
export function cleanTickerData(data) {
  if (!data) return null;

  // Ambil field penting yang akan dipakai downstream service.
  const { symbol, price, volume, high, low, open, time } = data;

  // Validasi: Tolak hanya jika null, NaN, atau negatif
  // TIDAK menolak angka kecil seperti 0.00000862
  if (
    price == null ||
    volume == null ||
    high == null ||
    low == null ||
    open == null ||
    !isFinite(price) ||
    !isFinite(volume) ||
    !isFinite(high) ||
    !isFinite(low) ||
    !isFinite(open) ||
    price < 0 ||
    volume < 0 ||
    high < 0 ||
    low < 0 ||
    open < 0
  ) {
    return null;
  }

  // Validasi relasi harga dasar agar data tidak anomali.
  // Validasi logika harga (low tidak boleh lebih besar dari high)
  if (low > high) return null;

  // Kembalikan nilai asli TANPA pembulatan toFixed(2)
  // Biarkan precision penuh untuk aset mikro seperti SHIB
  return {
    symbol,
    price: Number(price), // TIDAK pakai toFixed(2)
    volume: Number(volume),
    high: Number(high),
    low: Number(low),
    open: Number(open),
    time: typeof time === "number" ? time : new Date(time).getTime(),
  };
}

/** Membersihkan array candle sebelum disimpan ke database */
export function cleanCandleData(candles = []) {
  if (!Array.isArray(candles) || candles.length === 0) return [];

  // Filter candle rusak, rapikan presisi angka, lalu urutkan berdasarkan waktu.
  return candles
    .filter(
      (c) =>
        c &&
        isFinite(c.open) &&
        isFinite(c.close) &&
        isFinite(c.high) &&
        isFinite(c.low) &&
        isFinite(c.volume) &&
        c.volume >= 0 &&
        c.low <= c.high &&
        c.open > 0 &&
        c.close > 0,
    )
    .map((c) => ({
      time: Math.floor(c.time),
      open: Number(c.open.toFixed(8)),
      high: Number(c.high.toFixed(8)),
      low: Number(c.low.toFixed(8)),
      close: Number(c.close.toFixed(8)),
      volume: Number(c.volume.toFixed(8)),
    }))
    .sort((a, b) => a.time - b.time);
}

/** Menghapus duplikat candle berdasarkan timestamp */
export function removeDuplicateCandles(candles = []) {
  if (!Array.isArray(candles) || candles.length === 0) return [];

  // Set dipakai untuk melacak timestamp yang sudah pernah lewat.
  const seen = new Set();
  return candles.filter((candle) => {
    if (seen.has(candle.time)) return false;
    seen.add(candle.time);
    return true;
  });
}

/**
 * Melengkapi candle yang hilang dengan metode forward fill.
 *
 * Contoh penggunaan:
 * const candlesFilled = fillMissingCandles(candlesAsc, 60_000);
 */
export function fillMissingCandles(candles = [], intervalMs) {
  // Validasi input dasar agar fungsi aman dipakai ulang di berbagai service.
  if (!Array.isArray(candles) || candles.length === 0) return [];
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return [...candles];
  if (candles.length === 1) return [...candles];

  // Asumsi input sudah ascending; tetap buat salinan agar tidak mutasi data asli.
  const result = [candles[0]];

  for (let i = 1; i < candles.length; i++) {
    const prev = result[result.length - 1];
    const current = candles[i];

    // Jika timestamp tidak valid atau mundur, langsung lanjutkan candle asli.
    if (current.time <= prev.time) {
      result.push(current);
      continue;
    }

    // Isi gap antar candle menggunakan close candle sebelumnya.
    let nextExpectedTime = prev.time + intervalMs;
    while (nextExpectedTime < current.time) {
      result.push({
        time: nextExpectedTime,
        open: prev.close,
        high: prev.close,
        low: prev.close,
        close: prev.close,
        volume: 0,
      });
      nextExpectedTime += intervalMs;
    }

    // Tambahkan candle aktual dari sumber data.
    result.push(current);
  }

  return result;
}
