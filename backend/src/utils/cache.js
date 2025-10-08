/**
 * 💾 Cache Service - Data Caching Management
 * Handles intelligent caching of API responses and calculation results
 *
 * @description Service untuk caching data API dan hasil perhitungan
 * @features File-based caching, TTL support, automatic cleanup
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { formatTime } from "./helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default cache directory
const CACHE_DIR = path.join(__dirname, "../results");

// Default TTL (Time To Live) in milliseconds
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * 📁 Ensure cache directory exists
 */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log(`📁 Created cache directory: ${CACHE_DIR}`);
  }
}

/**
 * 🔑 Generate cache key from parameters
 * @param {string} prefix - Cache key prefix
 * @param {...any} params - Parameters to include in key
 * @returns {string} Generated cache key
 */
function generateCacheKey(prefix, ...params) {
  const paramString = params
    .map((p) => (typeof p === "object" ? JSON.stringify(p) : String(p)))
    .join("_");

  return `${prefix}_${paramString.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

/**
 * 📄 Get cache file path
 * @param {string} key - Cache key
 * @returns {string} File path
 */
function getCacheFilePath(key) {
  return path.join(CACHE_DIR, `${key}.json`);
}

/**
 * ⏰ Check if cache entry is expired
 * @param {number} timestamp - Cache timestamp
 * @param {number} ttl - Time to live in milliseconds
 * @returns {boolean} True if expired
 */
function isCacheExpired(timestamp, ttl = DEFAULT_TTL) {
  return Date.now() - timestamp > ttl;
}

/**
 * 💾 Save data to cache
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttl - Time to live in milliseconds
 * @returns {boolean} Success status
 */
export function setCache(key, data, ttl = DEFAULT_TTL) {
  try {
    ensureCacheDir();

    const cacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      ttl,
      expires: Date.now() + ttl,
      size: JSON.stringify(data).length,
    };

    const filePath = getCacheFilePath(key);
    fs.writeFileSync(filePath, JSON.stringify(cacheEntry, null, 2));

    console.log(
      `💾 Cached data: ${key} (${formatTime(cacheEntry.expires)} expiry)`
    );
    return true;
  } catch (error) {
    console.error(`❌ Error setting cache for ${key}:`, error.message);
    return false;
  }
}

/**
 * 📖 Get data from cache
 * @param {string} key - Cache key
 * @param {boolean} checkExpiry - Whether to check expiry (default: true)
 * @returns {any|null} Cached data or null if not found/expired
 */
export function getCache(key, checkExpiry = true) {
  try {
    const filePath = getCacheFilePath(key);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const cacheEntry = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // Check expiry if required
    if (checkExpiry && isCacheExpired(cacheEntry.timestamp, cacheEntry.ttl)) {
      console.log(`⏰ Cache expired for ${key}, removing...`);
      deleteCache(key);
      return null;
    }

    console.log(
      `📖 Cache hit: ${key} (cached ${formatTime(cacheEntry.timestamp)})`
    );
    return cacheEntry.data;
  } catch (error) {
    console.error(`❌ Error getting cache for ${key}:`, error.message);
    return null;
  }
}

/**
 * 🗑️ Delete cache entry
 * @param {string} key - Cache key
 * @returns {boolean} Success status
 */
export function deleteCache(key) {
  try {
    const filePath = getCacheFilePath(key);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Deleted cache: ${key}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ Error deleting cache for ${key}:`, error.message);
    return false;
  }
}

/**
 * ❓ Check if cache exists and is valid
 * @param {string} key - Cache key
 * @returns {boolean} True if cache exists and is valid
 */
export function hasValidCache(key) {
  try {
    const filePath = getCacheFilePath(key);

    if (!fs.existsSync(filePath)) {
      return false;
    }

    const cacheEntry = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return !isCacheExpired(cacheEntry.timestamp, cacheEntry.ttl);
  } catch (error) {
    return false;
  }
}

/**
 * 🧹 Clean up expired cache entries
 * @returns {number} Number of entries cleaned
 */
export function cleanupExpiredCache() {
  try {
    ensureCacheDir();

    const files = fs
      .readdirSync(CACHE_DIR)
      .filter((file) => file.endsWith(".json"));
    let cleanedCount = 0;

    for (const file of files) {
      try {
        const filePath = path.join(CACHE_DIR, file);
        const cacheEntry = JSON.parse(fs.readFileSync(filePath, "utf8"));

        if (isCacheExpired(cacheEntry.timestamp, cacheEntry.ttl)) {
          fs.unlinkSync(filePath);
          cleanedCount++;
          console.log(`🧹 Cleaned expired cache: ${cacheEntry.key}`);
        }
      } catch (error) {
        console.error(`❌ Error processing cache file ${file}:`, error.message);
      }
    }

    console.log(`🧹 Cache cleanup completed: ${cleanedCount} entries removed`);
    return cleanedCount;
  } catch (error) {
    console.error(`❌ Error during cache cleanup:`, error.message);
    return 0;
  }
}

/**
 * 📊 Get cache statistics
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  try {
    ensureCacheDir();

    const files = fs
      .readdirSync(CACHE_DIR)
      .filter((file) => file.endsWith(".json"));
    let totalSize = 0;
    let validEntries = 0;
    let expiredEntries = 0;

    for (const file of files) {
      try {
        const filePath = path.join(CACHE_DIR, file);
        const stats = fs.statSync(filePath);
        const cacheEntry = JSON.parse(fs.readFileSync(filePath, "utf8"));

        totalSize += stats.size;

        if (isCacheExpired(cacheEntry.timestamp, cacheEntry.ttl)) {
          expiredEntries++;
        } else {
          validEntries++;
        }
      } catch (error) {
        // Skip invalid files
      }
    }

    return {
      totalEntries: files.length,
      validEntries,
      expiredEntries,
      totalSize,
      formattedSize: formatSize(totalSize),
      cacheDir: CACHE_DIR,
    };
  } catch (error) {
    console.error(`❌ Error getting cache stats:`, error.message);
    return {
      totalEntries: 0,
      validEntries: 0,
      expiredEntries: 0,
      totalSize: 0,
      formattedSize: "0 B",
      cacheDir: CACHE_DIR,
    };
  }
}

/**
 * 📏 Format file size in human readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
function formatSize(bytes) {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * 🎯 Cache wrapper for functions
 * @param {string} key - Cache key
 * @param {Function} fn - Function to execute if cache miss
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Promise<any>} Cached or fresh data
 */
export async function cacheWrapper(key, fn, ttl = DEFAULT_TTL) {
  try {
    // Try to get from cache first
    const cachedData = getCache(key);
    if (cachedData !== null) {
      return cachedData;
    }

    // Execute function and cache result
    console.log(`🔄 Cache miss for ${key}, executing function...`);
    const result = await fn();

    // Cache the result
    setCache(key, result, ttl);

    return result;
  } catch (error) {
    console.error(`❌ Error in cache wrapper for ${key}:`, error.message);
    throw error;
  }
}

/**
 * 🔄 Clear all cache
 * @returns {boolean} Success status
 */
export function clearAllCache() {
  try {
    ensureCacheDir();

    const files = fs
      .readdirSync(CACHE_DIR)
      .filter((file) => file.endsWith(".json"));

    for (const file of files) {
      fs.unlinkSync(path.join(CACHE_DIR, file));
    }

    console.log(`🔄 Cleared all cache: ${files.length} entries removed`);
    return true;
  } catch (error) {
    console.error(`❌ Error clearing all cache:`, error.message);
    return false;
  }
}

// Specific cache functions for common use cases

/**
 * 📈 Cache historical data
 * @param {string} symbol - Trading symbol
 * @param {string} timeframe - Timeframe
 * @param {number} startTime - Start timestamp
 * @param {any} data - Historical data
 * @param {number} ttl - Time to live (default: 1 hour)
 */
export function cacheHistoricalData(
  symbol,
  timeframe,
  startTime,
  data,
  ttl = 60 * 60 * 1000
) {
  const key = generateCacheKey("historical", symbol, timeframe, startTime);
  return setCache(key, data, ttl);
}

/**
 * 📈 Get cached historical data
 * @param {string} symbol - Trading symbol
 * @param {string} timeframe - Timeframe
 * @param {number} startTime - Start timestamp
 */
export function getCachedHistoricalData(symbol, timeframe, startTime) {
  const key = generateCacheKey("historical", symbol, timeframe, startTime);
  return getCache(key);
}

/**
 * 📊 Cache indicator calculations
 * @param {string} symbol - Trading symbol
 * @param {string} indicator - Indicator name
 * @param {Object} params - Indicator parameters
 * @param {any} data - Calculated indicator data
 * @param {number} ttl - Time to live (default: 30 minutes)
 */
export function cacheIndicatorData(
  symbol,
  indicator,
  params,
  data,
  ttl = 30 * 60 * 1000
) {
  const key = generateCacheKey("indicator", symbol, indicator, params);
  return setCache(key, data, ttl);
}

/**
 * 📊 Get cached indicator calculations
 * @param {string} symbol - Trading symbol
 * @param {string} indicator - Indicator name
 * @param {Object} params - Indicator parameters
 */
export function getCachedIndicatorData(symbol, indicator, params) {
  const key = generateCacheKey("indicator", symbol, indicator, params);
  return getCache(key);
}

/**
 * ⏰ Setup automatic cache cleanup interval
 * @param {number} intervalMs - Cleanup interval in milliseconds (default: 1 hour)
 * @returns {NodeJS.Timeout} Interval timer ID
 */
export function setupCacheCleanup(intervalMs = 60 * 60 * 1000) {
  console.log(
    `⏰ Setting up cache cleanup every ${Math.round(intervalMs / 60000)} minutes`
  );

  // Run initial cleanup after 30 seconds
  setTimeout(() => {
    cleanupExpiredCache();
  }, 30000);

  // Setup recurring cleanup
  const cleanupInterval = setInterval(() => {
    cleanupExpiredCache();
  }, intervalMs);

  return cleanupInterval;
}

// Auto cleanup on module load
try {
  // Run cleanup on startup (but don't block)
  setTimeout(() => {
    cleanupExpiredCache();
  }, 5000);
} catch (error) {
  console.error("Error during cache initialization:", error.message);
}
