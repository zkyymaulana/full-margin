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

function getAuthHeaders() {
  if (!process.env.CMC_API_KEY) {
    throw new Error("CMC_API_KEY tidak ditemukan di .env");
  }

  return {
    "X-CMC_PRO_API_KEY": process.env.CMC_API_KEY,
    Accept: "application/json",
  };
}

/**
 * Ambil daftar top coins dari endpoint listings/latest.
 *
 * @param {number} limit - Jumlah coin yang ingin diambil.
 * @returns {Promise<object>} Response payload dari CoinMarketCap (objek `data`).
 */
export async function getTopCoins(limit) {
  try {
    const { data } = await axios.get(
      `${CMC_API_URL}/cryptocurrency/listings/latest`,
      {
        headers: getAuthHeaders(),
        params: { start: 1, limit, convert: "USD", sort: "market_cap" },
        timeout: TIMEOUT_LISTINGS_MS,
      }
    );

    return data;
  } catch (err) {
    const msg =
      err?.response?.data?.status?.error_message ||
      err?.response?.data?.message ||
      err.message;
    throw new Error(msg);
  }
}

/**
 * Ambil info coin (termasuk logo) berdasarkan symbol.
 *
 * @param {string|string[]} symbols - Simbol coin. Bisa string CSV ("BTC,ETH") atau array.
 * @returns {Promise<object>} Response payload dari CoinMarketCap (objek `data`).
 */
export async function getCoinLogos(symbols) {
  try {
    const symbolParam = Array.isArray(symbols) ? symbols.join(",") : symbols;

    const { data } = await axios.get(`${CMC_INFO_URL}/cryptocurrency/info`, {
      headers: getAuthHeaders(),
      params: { symbol: symbolParam },
      timeout: TIMEOUT_INFO_MS,
    });

    return data;
  } catch (err) {
    const msg =
      err?.response?.data?.status?.error_message ||
      err?.response?.data?.message ||
      err.message;
    throw new Error(msg);
  }
}
