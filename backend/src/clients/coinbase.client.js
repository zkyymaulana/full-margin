// src/clients/coinbase.client.js
// request HTTP ke API Coinbase
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const COINBASE_API =
  process.env.COINBASE_API_URL || "https://api.exchange.coinbase.com";
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT || "10000", 10);
const GRANULARITY_SECONDS = 3600; // 1 jam

export async function fetchCoinbasePairs() {
  const { data } = await axios.get(`${COINBASE_API}/products`, {
    timeout: API_TIMEOUT,
  });
  return data
    .filter((p) => p.status === "online" && !p.trading_disabled)
    .map((p) => p.id.toUpperCase());
}

export async function fetchLastCandle(symbol) {
  const now = new Date();
  const end = now.toISOString();
  const start = new Date(
    now.getTime() - GRANULARITY_SECONDS * 1000
  ).toISOString();

  const { data } = await axios.get(
    `${COINBASE_API}/products/${symbol}/candles`,
    {
      params: { start, end, granularity: GRANULARITY_SECONDS },
      timeout: API_TIMEOUT,
    }
  );

  if (!data?.length) return null;
  const [time, low, high, open, close, volume] = data[0];
  return {
    time: new Date(time * 1000).toISOString(),
    open,
    high,
    low,
    close,
    volume,
  };
}
