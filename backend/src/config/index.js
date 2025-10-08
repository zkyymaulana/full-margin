/**
 * ⚙️ Configuration - Application Settings (Dynamic Edition)
 * Centralized configuration management for the backend with dynamic symbol loading
 *
 * @description Konfigurasi terpusat untuk aplikasi backend dengan loading symbol dinamis
 * @features Environment variables, API endpoints, dynamic settings from CoinGecko + Coinbase
 */

import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Application Configuration
export const config = {
  // Server Settings
  server: {
    port: process.env.PORT || 8000,
    host: process.env.HOST || "localhost",
    environment: process.env.NODE_ENV || "development",
  },

  // CORS Settings
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  },

  // Cache Settings
  cache: {
    defaultTTL: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    indicatorTTL: 60 * 60 * 1000, // 1 hour for indicators (since we use 1h timeframe)
    backtestTTL: 2 * 60 * 60 * 1000, // 2 hours for backtest results
    signalsTTL: 30 * 60 * 1000, // 30 minutes for signals
    symbolsTTL: 60 * 60 * 1000, // 1 hour for symbols cache
  },

  // API Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },

  // Cryptocurrency Settings - Dynamic Loading
  crypto: {
    defaultSymbol: "BTC-USD", // Default fallback symbol
    defaultTimeframe: "1h", // Hardcoded to 1 hour
    supportedTimeframes: ["1h"], // Only 1 hour supported
    // Symbols are now loaded dynamically from CoinGecko + Coinbase
    // No more hardcoded supportedSymbols array
    dynamicSymbols: {
      enabled: true,
      source: "coingecko-coinbase", // CoinGecko market cap + Coinbase availability
      refreshInterval: 60 * 60 * 1000, // 1 hour
      maxSymbols: 100, // Top 100 market cap
      cacheFile: "src/results/top100-coinbase.json",
    },
  },

  // Indicator Default Parameters (optimized for 1-hour timeframe)
  indicators: {
    sma: {
      shortPeriod: 12, // 12 hours
      mediumPeriod: 24, // 24 hours (1 day)
      longPeriod: 168, // 168 hours (1 week)
    },
    ema: {
      period: 24, // 24 hours (1 day)
    },
    rsi: {
      period: 14, // 14 hours
      oversold: 30,
      overbought: 70,
    },
    stochastic: {
      kPeriod: 14, // 14 hours
      dPeriod: 3, // 3 hours
      oversold: 20,
      overbought: 80,
    },
    stochasticRSI: {
      rsiPeriod: 14, // 14 hours
      stochPeriod: 14, // 14 hours
      kPeriod: 3, // 3 hours
      dPeriod: 3, // 3 hours
    },
    macd: {
      fastPeriod: 12, // 12 hours
      slowPeriod: 26, // 26 hours
      signalPeriod: 9, // 9 hours
    },
    bollingerBands: {
      period: 20, // 20 hours
      multiplier: 2,
    },
    parabolicSAR: {
      step: 0.02,
      maxStep: 0.2,
    },
  },

  // Backtest Settings
  backtest: {
    defaultStartDate: "2024-01-01", // Recent start date for 1h data
    maxDataPoints: 8760, // 1 year of hourly data
    includeTradingFees: false,
    tradingFeePercent: 0.1,
  },

  // External API Settings
  api: {
    coinbase: {
      baseURL: "https://api.exchange.coinbase.com",
      timeout: 15000,
      maxRetries: 3,
      rateLimit: 500, // 500ms delay between requests
    },
    coingecko: {
      baseURL: "https://api.coingecko.com/api/v3",
      timeout: 15000,
      maxRetries: 3,
      rateLimit: 1000, // 1s delay between requests (free tier)
      endpoints: {
        markets: "/coins/markets",
        ping: "/ping",
      },
    },
  },

  // Logging Settings
  logging: {
    level: process.env.LOG_LEVEL || "info",
    enableConsole: true,
    enableFile: false,
    maxFiles: 5,
    maxSize: "10m",
  },

  // File Paths
  paths: {
    cache: "./src/results",
    logs: "./logs",
    exports: "./exports",
    uploads: "./uploads",
  },

  // WebSocket Settings - Disabled for REST-only version
  websocket: {
    enabled: false, // Disabled since we're using REST API only
    pingInterval: 30000,
    pongTimeout: 5000,
    maxConnections: 1000,
    allowedOrigins: process.env.WS_ORIGINS?.split(",") || ["*"],
  },

  // Security Settings
  security: {
    enableHelmet: true,
    enableRateLimit: true,
    maxRequestSize: "10mb",
    allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  },

  // Data Source Configuration
  dataSource: {
    provider: "dynamic", // Changed from "coinbase" to "dynamic"
    primarySource: "coingecko", // For market cap ranking
    dataSource: "coinbase", // For actual price data
    timeframe: "1h",
    maxSymbols: 100,
    realtimeEnabled: false,
    description:
      "Top 100 market cap coins (CoinGecko) available on Coinbase with 1-hour timeframe",
    features: [
      "Dynamic symbol loading",
      "Market cap based ranking",
      "Cross-platform matching",
      "Auto symbol refresh",
      "Fallback support",
    ],
  },

  // Preload Settings
  preload: {
    enabled: true,
    maxCoinsToPreload: 50, // Limit for rate limiting
    preloadOnStartup: true,
    preloadInterval: 24 * 60 * 60 * 1000, // 24 hours
    dataRange: 24 * 60 * 60 * 1000, // 24 hours of data
  },
};

// Helper functions for configuration
export const isDevelopment = () => config.server.environment === "development";
export const isProduction = () => config.server.environment === "production";
export const isTesting = () => config.server.environment === "test";

// Get configuration value with fallback
export const getConfig = (path, fallback = null) => {
  try {
    const keys = path.split(".");
    let value = config;

    for (const key of keys) {
      value = value[key];
      if (value === undefined) {
        return fallback;
      }
    }

    return value;
  } catch (error) {
    console.warn(`Config path "${path}" not found, using fallback:`, fallback);
    return fallback;
  }
};

// Validate required environment variables
export const validateConfig = () => {
  const errors = [];

  // Add validation rules here
  if (!config.server.port) {
    errors.push("Server port is required");
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.join(", ")}`);
  }

  console.log("✅ Configuration validated successfully");
  console.log(
    `🔧 Mode: ${config.dataSource.provider} (${config.dataSource.description})`
  );
  console.log(
    `📊 Dynamic symbols: ${config.crypto.dynamicSymbols.enabled ? "Enabled" : "Disabled"}`
  );
  console.log(`⏰ Timeframe: ${config.crypto.defaultTimeframe} (fixed)`);

  return true;
};

// Export default config
export default config;
