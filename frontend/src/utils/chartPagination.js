/**
 * Utilitas pagination chart.
 * Kumpulan helper untuk infinite scroll pada Lightweight Charts.
 */

/**
 * Gabungkan data candle lama dan baru lalu urutkan berdasarkan waktu.
 */
export const mergeCandlesData = (existingData, newData) => {
  // Gunakan Set agar pengecekan duplikasi timestamp cepat.
  const existingTimes = new Set(existingData.map((d) => d.time));

  // Ambil hanya data baru yang belum pernah ada.
  const uniqueNewData = newData.filter((d) => !existingTimes.has(d.time));

  // Gabungkan lalu urutkan ascending (lama ke baru).
  const merged = [...existingData, ...uniqueNewData];
  merged.sort((a, b) => {
    const timeA = typeof a.time === "bigint" ? Number(a.time) : a.time;
    const timeB = typeof b.time === "bigint" ? Number(b.time) : b.time;
    return timeA - timeB;
  });

  return merged;
};

/**
 * Ubah format candle API ke format yang dibaca Lightweight Charts.
 */
export const transformCandleData = (candles) => {
  return candles.map((d) => ({
    // Library chart memakai satuan detik, bukan milidetik.
    time: Number(d.time) / 1000,
    open: Number(d.open),
    high: Number(d.high),
    low: Number(d.low),
    close: Number(d.close),
  }));
};

/**
 * Cek apakah viewport mendekati sisi kiri (data lebih lama).
 */
export const isNearLeftEdge = (visibleRange, dataRange, threshold = 0.1) => {
  if (!visibleRange || !dataRange) return false;

  const { from } = visibleRange;
  const { minTime } = dataRange;

  const totalRange = dataRange.maxTime - minTime;
  const distanceFromStart = from - minTime;

  return distanceFromStart < totalRange * threshold;
};

/**
 * Cek apakah viewport mendekati sisi kanan (data lebih baru).
 */
export const isNearRightEdge = (visibleRange, dataRange, threshold = 0.1) => {
  if (!visibleRange || !dataRange) return false;

  const { to } = visibleRange;
  const { maxTime } = dataRange;

  const totalRange = maxTime - dataRange.minTime;
  const distanceFromEnd = maxTime - to;

  return distanceFromEnd < totalRange * threshold;
};

/**
 * Debounce untuk membatasi pemanggilan fetch beruntun.
 */
export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Hitung range tampilan setelah data baru ditambahkan.
 * Posisi view saat ini dipertahankan agar pengalaman scroll stabil.
 */
export const calculatePreservedRange = (
  currentRange,
  oldDataLength,
  newDataLength,
  isLoadingOlder,
) => {
  if (!currentRange) return null;

  const { from, to } = currentRange;
  const visibleDuration = to - from;

  if (isLoadingOlder) {
    // Data lama ditambah di awal, range tetap dipertahankan.
    const addedDataPoints = newDataLength - oldDataLength;
    return {
      from: from,
      to: to,
    };
  } else {
    // Data baru ditambah di akhir, posisi view tetap.
    return {
      from: from,
      to: to,
    };
  }
};

/**
 * Ambil rentang waktu minimum dan maksimum dari data candle.
 */
export const getDataRange = (candles) => {
  if (!candles || candles.length === 0) return null;

  const times = candles.map((c) => {
    const time = typeof c.time === "bigint" ? Number(c.time) : c.time;
    // Konversi ke detik agar sesuai satuan time scale chart.
    return time / 1000;
  });

  return {
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
  };
};
