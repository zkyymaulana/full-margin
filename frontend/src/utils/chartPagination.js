/**
 * Chart Pagination Utilities
 * Helper functions untuk infinite scroll pagination pada Lightweight Charts
 */

/**
 * Merge dan sort data candles dari multiple pages
 * Menghindari duplikasi berdasarkan time
 */
export const mergeCandlesData = (existingData, newData) => {
  // Buat Set dari existing times untuk cek duplikasi
  const existingTimes = new Set(existingData.map(d => d.time));
  
  // Filter data baru yang belum ada
  const uniqueNewData = newData.filter(d => !existingTimes.has(d.time));
  
  // Gabungkan dan sort berdasarkan time (ascending)
  const merged = [...existingData, ...uniqueNewData];
  merged.sort((a, b) => {
    const timeA = typeof a.time === 'bigint' ? Number(a.time) : a.time;
    const timeB = typeof b.time === 'bigint' ? Number(b.time) : b.time;
    return timeA - timeB;
  });
  
  return merged;
};

/**
 * Transform candle data untuk Lightweight Charts format
 */
export const transformCandleData = (candles) => {
  return candles.map(d => ({
    time: Number(d.time) / 1000, // Convert to seconds
    open: Number(d.open),
    high: Number(d.high),
    low: Number(d.low),
    close: Number(d.close),
  }));
};

/**
 * Cek apakah user scroll mendekati edge kiri chart (older data)
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
 * Cek apakah user scroll mendekati edge kanan chart (newer data)
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
 * Debounce function untuk limit fetch calls
 */
export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Calculate visible range after adding new data
 * Preserve user's current view position
 */
export const calculatePreservedRange = (currentRange, oldDataLength, newDataLength, isLoadingOlder) => {
  if (!currentRange) return null;
  
  const { from, to } = currentRange;
  const visibleDuration = to - from;
  
  if (isLoadingOlder) {
    // Data ditambahkan di awal (older), shift range
    const addedDataPoints = newDataLength - oldDataLength;
    return {
      from: from,
      to: to
    };
  } else {
    // Data ditambahkan di akhir (newer), keep current position
    return {
      from: from,
      to: to
    };
  }
};

/**
 * Get data range (min and max time) from candles
 */
export const getDataRange = (candles) => {
  if (!candles || candles.length === 0) return null;
  
  const times = candles.map(c => {
    const time = typeof c.time === 'bigint' ? Number(c.time) : c.time;
    return time / 1000; // Convert to seconds for chart
  });
  
  return {
    minTime: Math.min(...times),
    maxTime: Math.max(...times)
  };
};
