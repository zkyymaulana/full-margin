/**
 * File: src/clients/coinmarketcap.client.js
 * -------------------------------------------------
 * Tujuan: Client HTTP untuk CoinMarketCap.
 * - Hanya berisi axios request, headers, params, endpoint URL, dan error handling.
 * - Business logic tetap di service layer.
 */

import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const CMC_API_URL =
  process.env.CMC_API_URL || "https://pro-api.coinmarketcap.com/v1";
const CMC_INFO_URL = "https://pro-api.coinmarketcap.com/v2";

const TIMEOUT_LISTINGS_MS = 30000;
const TIMEOUT_INFO_MS = 30000;

// Ambil pesan error paling relevan dari response axios.
function extractErrorMessage(err) {
  return (
    err?.response?.data?.status?.error_message ||
    err?.response?.data?.message ||
    err.message
  );
}

// Siapkan header autentikasi untuk setiap request ke CoinMarketCap.
function getAuthHeaders() {
  if (!process.env.CMC_API_KEY) {
    throw new Error("CMC_API_KEY tidak ditemukan di .env");
  }

  return {
    "X-CMC_PRO_API_KEY": process.env.CMC_API_KEY,
    Accept: "application/json",
  };
}

// Ambil daftar koin berdasarkan market cap dari endpoint listings/latest.
export async function getTopCoins(limit = 20) {
  try {
    // Query daftar coin dari ranking market cap tertinggi.
    const { data } = await axios.get(
      `${CMC_API_URL}/cryptocurrency/listings/latest`,
      {
        headers: getAuthHeaders(),
        params: { start: 1, limit, convert: "USD", sort: "market_cap" },
        timeout: TIMEOUT_LISTINGS_MS,
      },
    );

    return data;
  } catch (err) {
    const msg = extractErrorMessage(err);
    throw new Error(msg);
  }
}

// Ambil informasi koin, termasuk logo, berdasarkan satu atau banyak simbol.
export async function getCoinLogos(symbols) {
  try {
    // Support input array maupun CSV string agar fleksibel dipakai service.
    const symbolParam = Array.isArray(symbols) ? symbols.join(",") : symbols;

    const { data } = await axios.get(`${CMC_INFO_URL}/cryptocurrency/info`, {
      headers: getAuthHeaders(),
      params: { symbol: symbolParam },
      timeout: TIMEOUT_INFO_MS,
    });

    return data;
  } catch (err) {
    const msg = extractErrorMessage(err);
    throw new Error(msg);
  }
}
