// Format harga dengan presisi dinamis berdasarkan besar nilainya.
export const formatPrice = (price) => {
  // Harga besar tampil dengan pemisah ribuan.
  if (price >= 1000)
    return `$${price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  // Harga menengah cukup 2 desimal.
  if (price >= 1) return `$${price.toFixed(2)}`;
  // Harga kecil diberi desimal lebih banyak agar tetap informatif.
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  if (price >= 0.0001) return `$${price.toFixed(6)}`;
  if (price > 0) return `$${price.toFixed(10)}`;
  return `$${price.toFixed(8)}`;
};

// Format volume ke notasi ringkas (K, M, B).
export const formatVolume = (vol) => {
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
  if (vol >= 1e3) return `$${(vol / 1e3).toFixed(2)}K`;
  return `$${vol.toFixed(2)}`;
};

// Format market cap ke notasi ringkas (M, B, T).
export const formatMarketCap = (vol) => {
  if (vol >= 1e12) return `$${(vol / 1e12).toFixed(2)}T`;
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
  return `$${vol.toFixed(2)}`;
};
