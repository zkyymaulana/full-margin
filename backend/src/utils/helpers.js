/**
 * 🛠️ Helper Utilities - Common Functions
 * Contains utility functions used across the application
 * 
 * @description Helper functions untuk formatting, caching, dan operasi umum
 * @features Time formatting, data validation, mathematical operations
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

// Configure dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * 🕐 Format timestamp ke readable string
 * @param {number} timestamp - Timestamp dalam milliseconds
 * @param {string} format - Format string (default: "DD/MM/YYYY HH:mm:ss")
 * @param {string} tz - Timezone (default: "Asia/Jakarta")
 * @returns {string} Formatted time string
 */
export function formatTime(timestamp, format = "DD/MM/YYYY HH:mm:ss", tz = "Asia/Jakarta") {
  try {
    return dayjs(timestamp).tz(tz).format(format);
  } catch (error) {
    console.error("Error formatting time:", error);
    return "Invalid Date";
  }
}

/**
 * 🕐 Get current timestamp dalam berbagai format
 * @returns {Object} Object containing different timestamp formats
 */
export function getCurrentTime() {
  const now = dayjs().tz("Asia/Jakarta");
  return {
    timestamp: now.valueOf(),
    unix: now.unix(),
    iso: now.toISOString(),
    formatted: now.format("DD/MM/YYYY HH:mm:ss"),
    jakartaTime: now.format("DD MMMM YYYY, HH:mm:ss")
  };
}

/**
 * 📊 Calculate percentage change
 * @param {number} current - Current value
 * @param {number} previous - Previous value
 * @returns {number} Percentage change
 */
export function calculatePercentageChange(current, previous) {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * 📈 Calculate simple moving average manually
 * @param {number[]} values - Array of numbers
 * @param {number} period - Period for average
 * @returns {number} Moving average value
 */
export function calculateAverage(values, period = null) {
  if (!values || values.length === 0) return 0;
  
  const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (validValues.length === 0) return 0;
  
  const dataToUse = period ? validValues.slice(-period) : validValues;
  return dataToUse.reduce((sum, val) => sum + val, 0) / dataToUse.length;
}

/**
 * 🔢 Round number to specified decimal places
 * @param {number} number - Number to round
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {number} Rounded number
 */
export function roundToDecimals(number, decimals = 2) {
  if (isNaN(number)) return 0;
  return Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * ✅ Validate if value is a valid number
 * @param {any} value - Value to validate
 * @returns {boolean} True if valid number
 */
export function isValidNumber(value) {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * 📊 Validate price data structure
 * @param {Object} data - Price data object
 * @returns {Object} Validation result with isValid and errors
 */
export function validatePriceData(data) {
  const errors = [];
  
  if (!data) {
    errors.push("Price data is required");
    return { isValid: false, errors };
  }

  const requiredFields = ['time', 'open', 'high', 'low', 'close'];
  
  for (const field of requiredFields) {
    if (!(field in data)) {
      errors.push(`Missing required field: ${field}`);
    } else if (!isValidNumber(data[field]) && field !== 'time') {
      errors.push(`Invalid ${field}: must be a valid number`);
    }
  }

  // Validate price relationships
  if (data.high < data.low) {
    errors.push("High price cannot be less than low price");
  }
  
  if (data.close > data.high || data.close < data.low) {
    errors.push("Close price must be between high and low prices");
  }
  
  if (data.open > data.high || data.open < data.low) {
    errors.push("Open price must be between high and low prices");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 🎯 Calculate win rate from trades array
 * @param {Array} trades - Array of trade objects with returnPct property
 * @returns {number} Win rate percentage
 */
export function calculateWinRate(trades) {
  if (!trades || trades.length === 0) return 0;
  
  const profitableTrades = trades.filter(trade => 
    trade.returnPct && trade.returnPct > 0
  );
  
  return (profitableTrades.length / trades.length) * 100;
}

/**
 * 💰 Calculate total return from trades
 * @param {Array} trades - Array of trade objects with returnPct property
 * @returns {number} Total compound return percentage
 */
export function calculateTotalReturn(trades) {
  if (!trades || trades.length === 0) return 0;
  
  let totalReturn = 1; // Start with 100% (1.0)
  
  for (const trade of trades) {
    if (trade.returnPct && isValidNumber(trade.returnPct)) {
      totalReturn *= (1 + trade.returnPct / 100);
    }
  }
  
  return (totalReturn - 1) * 100; // Convert back to percentage
}

/**
 * 📉 Calculate maximum drawdown from trades
 * @param {Array} trades - Array of trade objects with returnPct property
 * @returns {number} Maximum drawdown percentage
 */
export function calculateMaxDrawdown(trades) {
  if (!trades || trades.length === 0) return 0;
  
  let peak = 1;
  let maxDrawdown = 0;
  let cumulative = 1;
  
  for (const trade of trades) {
    if (trade.returnPct && isValidNumber(trade.returnPct)) {
      cumulative *= (1 + trade.returnPct / 100);
      
      if (cumulative > peak) {
        peak = cumulative;
      }
      
      const drawdown = (peak - cumulative) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
  }
  
  return maxDrawdown * 100; // Convert to percentage
}

/**
 * 🔍 Deep clone object (for avoiding reference issues)
 * @param {any} obj - Object to clone
 * @returns {any} Deep cloned object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  
  const cloned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * 📝 Create summary statistics from backtest results
 * @param {Array} results - Array of backtest result objects
 * @returns {Object} Summary statistics
 */
export function createSummaryStatistics(results) {
  if (!results || results.length === 0) {
    return {
      totalStrategies: 0,
      avgROI: 0,
      avgWinRate: 0,
      avgMaxDD: 0,
      profitableStrategies: 0,
      profitabilityRate: 0
    };
  }

  const validResults = results.filter(r => r && isValidNumber(r.roi));
  const profitableCount = validResults.filter(r => r.roi > 0).length;
  
  return {
    totalStrategies: validResults.length,
    avgROI: roundToDecimals(calculateAverage(validResults.map(r => r.roi))),
    avgWinRate: roundToDecimals(calculateAverage(validResults.map(r => r.winRate || 0))),
    avgMaxDD: roundToDecimals(calculateAverage(validResults.map(r => r.maxDrawdown || 0))),
    profitableStrategies: profitableCount,
    profitabilityRate: validResults.length > 0 ? roundToDecimals((profitableCount / validResults.length) * 100) : 0
  };
}

/**
 * 🎨 Generate color based on value (green for positive, red for negative)
 * @param {number} value - Numeric value
 * @returns {string} Color code or name
 */
export function getColorForValue(value) {
  if (!isValidNumber(value)) return '#999999'; // Gray for invalid
  if (value > 0) return '#00C851'; // Green for positive
  if (value < 0) return '#FF4444'; // Red for negative
  return '#999999'; // Gray for zero
}

/**
 * 📊 Format large numbers with appropriate suffixes
 * @param {number} number - Number to format
 * @returns {string} Formatted number string
 */
export function formatLargeNumber(number) {
  if (!isValidNumber(number)) return '0';
  
  const abs = Math.abs(number);
  const sign = number < 0 ? '-' : '';
  
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + 'K';
  
  return sign + abs.toFixed(2);
}

/**
 * ⏱️ Create delay/sleep function
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after delay
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 🔄 Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Promise that resolves with function result
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delayMs = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
      await delay(delayMs);
    }
  }
  
  throw lastError;
}