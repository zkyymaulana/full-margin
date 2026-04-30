import { WebSocket, WebSocketServer } from "ws";

const COINBASE_WS_URL = "wss://ws-feed.exchange.coinbase.com";
const COINBASE_PRODUCTS = [
  "BTC-USD",
  "ETH-USD",
  "ADA-USD",
  "SOL-USD",
  "XRP-USD",
  "DOGE-USD",
  "DOT-USD",
  "LTC-USD",
  "AVAX-USD",
  "LINK-USD",
];

const FRONTEND_WS_PATH = "/ws/ticker";
const MAX_RECONNECT_DELAY_MS = 30000;
const BASE_RECONNECT_DELAY_MS = 1000;
const CANDLE_TIMEFRAME = "1h";
const CANDLE_TIMEFRAME_MS = 60 * 60 * 1000;

const frontendClients = new Set();
const lastTickers = new Map();
const liveCandles = new Map();

let backendWss = null;
let coinbaseWs = null;
let coinbaseStatus = "idle";
let reconnectTimer = null;
let reconnectAttempt = 0;
let hasSubscribed = false;

function buildSnapshotPayload() {
  const snapshot = {};
  const candleSnapshot = {};

  for (const [symbol, ticker] of lastTickers.entries()) {
    snapshot[symbol] = ticker;
  }

  for (const [symbol, candle] of liveCandles.entries()) {
    candleSnapshot[symbol] = candle;
  }

  return {
    type: "snapshot",
    data: snapshot,
    candles: candleSnapshot,
  };
}

function broadcastToClients(payload) {
  if (!frontendClients.size) return;

  const message = JSON.stringify(payload);

  for (const client of frontendClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function handleCoinbaseTicker(message) {
  if (message?.type !== "ticker") return;

  const symbol = String(message.product_id || "").toUpperCase();
  if (!COINBASE_PRODUCTS.includes(symbol)) return;

  const price = Number(message.price);
  if (!Number.isFinite(price)) return;

  const timeValue = message.time
    ? new Date(message.time).getTime()
    : Date.now();

  const payload = {
    type: "ticker",
    product_id: symbol,
    price,
    time: timeValue,
  };

  lastTickers.set(symbol, {
    symbol,
    price,
    time: timeValue,
  });

  const bucketStart =
    Math.floor(timeValue / CANDLE_TIMEFRAME_MS) * CANDLE_TIMEFRAME_MS;
  const existingCandle = liveCandles.get(symbol);
  let nextCandle = existingCandle;

  if (!existingCandle || existingCandle.time !== bucketStart) {
    nextCandle = {
      symbol,
      timeframe: CANDLE_TIMEFRAME,
      time: bucketStart,
      open: price,
      high: price,
      low: price,
      close: price,
    };
  } else {
    const high = Math.max(Number(existingCandle.high), price);
    const low = Math.min(Number(existingCandle.low), price);

    nextCandle = {
      ...existingCandle,
      high,
      low,
      close: price,
    };
  }

  liveCandles.set(symbol, nextCandle);

  const candlePayload = {
    type: "candle",
    product_id: symbol,
    timeframe: CANDLE_TIMEFRAME,
    data: nextCandle,
  };

  broadcastToClients(payload);
  broadcastToClients(candlePayload);
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  const delay = Math.min(
    MAX_RECONNECT_DELAY_MS,
    BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempt),
  );

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectAttempt += 1;
    connectToCoinbase();
  }, delay);
}

function resetReconnectState() {
  reconnectAttempt = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function connectToCoinbase() {
  if (coinbaseStatus === "connecting" || coinbaseStatus === "open") {
    return;
  }

  coinbaseStatus = "connecting";
  hasSubscribed = false;

  coinbaseWs = new WebSocket(COINBASE_WS_URL);

  coinbaseWs.on("open", () => {
    coinbaseStatus = "open";
    resetReconnectState();

    if (!hasSubscribed) {
      coinbaseWs.send(
        JSON.stringify({
          type: "subscribe",
          product_ids: COINBASE_PRODUCTS,
          channels: ["ticker"],
        }),
      );
      hasSubscribed = true;
    }
  });

  coinbaseWs.on("message", (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      handleCoinbaseTicker(parsed);
    } catch (err) {
      // Abaikan pesan non-JSON dari Coinbase.
    }
  });

  coinbaseWs.on("close", () => {
    coinbaseStatus = "closed";
    coinbaseWs = null;
    hasSubscribed = false;
    scheduleReconnect();
  });

  coinbaseWs.on("error", () => {
    coinbaseStatus = "error";
    try {
      coinbaseWs?.close();
    } catch (err) {
      // Abaikan error close.
    }
  });
}

function setupFrontendWebSocket(server) {
  if (backendWss) return backendWss;

  backendWss = new WebSocketServer({ server, path: FRONTEND_WS_PATH });

  backendWss.on("connection", (client) => {
    frontendClients.add(client);

    // Kirim snapshot pertama agar UI langsung punya harga terakhir.
    client.send(JSON.stringify(buildSnapshotPayload()));

    client.on("close", () => {
      frontendClients.delete(client);
    });
  });

  return backendWss;
}

export function initTickerWebsocket(server) {
  setupFrontendWebSocket(server);
  connectToCoinbase();
}

export function shutdownTickerWebsocket() {
  if (backendWss) {
    backendWss.close();
    backendWss = null;
  }

  for (const client of frontendClients) {
    try {
      client.close();
    } catch (err) {
      // Abaikan error close.
    }
  }
  frontendClients.clear();

  if (coinbaseWs) {
    try {
      coinbaseWs.close();
    } catch (err) {
      // Abaikan error close.
    }
  }
  coinbaseWs = null;
  coinbaseStatus = "idle";
  hasSubscribed = false;
  liveCandles.clear();
  resetReconnectState();
}

export function getLastTicker(symbol) {
  if (!symbol) return null;
  return lastTickers.get(String(symbol).toUpperCase()) || null;
}

export function getAllTickersSnapshot() {
  const snapshot = {};
  for (const [symbol, ticker] of lastTickers.entries()) {
    snapshot[symbol] = ticker;
  }
  return snapshot;
}

export function getLiveCandle(symbol) {
  if (!symbol) return null;
  return liveCandles.get(String(symbol).toUpperCase()) || null;
}
