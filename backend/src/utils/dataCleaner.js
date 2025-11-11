// src/utils/dataCleaner.js

/** Membersihkan data ticker dari Coinbase */
export function cleanTickerData(data) {
  if (!data) return null;

  const { symbol, price, volume, high, low, open, time } = data;

  // Validasi nilai numerik (tidak boleh NaN atau <= 0)
  if ([price, volume, high, low, open].some((v) => !isFinite(v) || v <= 0))
    return null;

  // Validasi logika harga (low tidak boleh lebih besar dari high)
  if (low > high) return null;

  // Normalisasi format angka dan waktu
  return {
    symbol,
    price: Number(price.toFixed(2)),
    volume: Number(volume.toFixed(2)),
    high: Number(high.toFixed(2)),
    low: Number(low.toFixed(2)),
    open: Number(open.toFixed(2)),
    time: new Date(time).getTime() || Date.now(),
  };
}

/** Membersihkan array candle sebelum disimpan ke database */
export function cleanCandleData(candles = []) {
  if (!Array.isArray(candles) || candles.length === 0) return [];

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
        c.close > 0
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

/** Membersihkan data top coin dari CoinMarketCap */
export function cleanTopCoinData(coins = []) {
  if (!Array.isArray(coins) || coins.length === 0) return [];

  return coins
    .filter(
      (c) =>
        c &&
        typeof c.symbol === "string" &&
        Number.isInteger(c.rank) &&
        c.rank > 0 &&
        isFinite(c.price) &&
        isFinite(c.marketCap) &&
        c.price > 0 &&
        c.marketCap > 0
    )
    .map((c) => ({
      rank: c.rank,
      name: c.name || "",
      symbol: c.symbol.toUpperCase(),
      price: Number(c.price.toFixed(2)),
      marketCap: Number(c.marketCap.toFixed(2)),
      volume24h: c.volume24h ? Number(c.volume24h.toFixed(2)) : 0,
    }))
    .sort((a, b) => a.rank - b.rank);
}

/** Menghapus duplikat candle berdasarkan timestamp */
export function removeDuplicateCandles(candles = []) {
  if (!Array.isArray(candles) || candles.length === 0) return [];

  const seen = new Set();
  return candles.filter((candle) => {
    if (seen.has(candle.time)) return false;
    seen.add(candle.time);
    return true;
  });
}
