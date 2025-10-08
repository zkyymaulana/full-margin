/**
 * 📊 MarketCap Service (Environment-based)
 * @description Ambil Top 100 Coin dari CoinGecko dan cocokkan dengan produk di Coinbase
 *              menggunakan konfigurasi dari .env file.
 */

import axios from "axios";
import dotenv from "dotenv";

dotenv.config(); // load .env

// ✅ Gunakan konfigurasi dari .env
const COINGECKO_API = `${process.env.COINGECKO_API_URL || "https://api.coingecko.com/api/v3"}/coins/markets`;
const COINBASE_API = `${process.env.COINBASE_API_URL || "https://api.exchange.coinbase.com"}/products`;
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT || "10000", 10);

/**
 * 🥇 Ambil top 100 coin dari CoinGecko
 */
async function fetchTop100CoinGecko() {
  const res = await axios.get(COINGECKO_API, {
    params: {
      vs_currency: "usd",
      order: "market_cap_desc",
      per_page: 100,
      page: 1,
      sparkline: false,
    },
    timeout: API_TIMEOUT,
  });
  return res.data;
}

/**
 * 💱 Ambil semua produk aktif dari Coinbase (pair apapun)
 */
async function fetchCoinbaseProducts() {
  const res = await axios.get(COINBASE_API, {
    timeout: API_TIMEOUT,
  });
  return res.data.filter(
    (p) => p.status === "online" && p.trading_disabled === false
  );
}

/**
 * 🔄 Cocokkan 100 coin CoinGecko dengan produk Coinbase
 * @returns {Promise<{ success: boolean, pairs: string[] }>}
 */
/**
 * 🔄 Cocokkan 100 coin CoinGecko dengan produk Coinbase
 * @returns {Promise<{ success: boolean, pairs: string[], details: object[] }>}
 */
export async function getTop100WithCache() {
  try {
    console.log("🚀 Mengambil Top 100 Coin (CoinGecko + Coinbase)");

    const [cgCoins, cbProducts] = await Promise.all([
      fetchTop100CoinGecko(),
      fetchCoinbaseProducts(),
    ]);

    // buat peta symbol Coinbase
    const cbMap = new Map();
    cbProducts.forEach((p) => cbMap.set(p.base_currency.toLowerCase(), p.id));

    const matched = [];
    const details = [];

    cgCoins.forEach((coin, index) => {
      const pair = cbMap.get(coin.symbol.toLowerCase());
      if (pair) {
        matched.push(pair);
        details.push({
          rank: index + 1,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          price: coin.current_price,
          marketCap: coin.market_cap,
          pair,
        });
      }
    });

    console.log(`✅ ${matched.length} dari 100 tersedia di Coinbase`);
    return {
      success: true,
      pairs: matched,
      details, // ✅ tambahkan ini
      total: matched.length,
      metadata: {
        coinGeckoTotal: cgCoins.length,
        coinbaseTotal: cbProducts.length,
        matchRate: `${((matched.length / cgCoins.length) * 100).toFixed(1)}%`,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("❌ Gagal mengambil data:", err.message);
    return { success: false, pairs: [], details: [] };
  }
}

/**
 * 📋 Ambil hanya daftar pair (contoh: ['BTC-USD', 'ETH-USDT'])
 */
export async function getTop100Pairs() {
  const res = await getTop100WithCache();
  return res.success ? res.pairs : [];
}
