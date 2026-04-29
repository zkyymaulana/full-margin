import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_PATH = "/ws/ticker";
const MAX_RECONNECT_DELAY_MS = 30000;
const BASE_RECONNECT_DELAY_MS = 1000;

const sharedState = {
  ws: null,
  status: "idle",
  reconnectTimer: null,
  reconnectAttempt: 0,
  listeners: new Set(),
  ticks: new Map(),
  candles: new Map(),
};

const notifyListeners = () => {
  const snapshot = Object.fromEntries(sharedState.ticks.entries());
  const candleSnapshot = Object.fromEntries(sharedState.candles.entries());
  for (const listener of sharedState.listeners) {
    listener(snapshot, candleSnapshot, sharedState.status);
  }
};

const resolveWsUrl = () => {
  const direct = import.meta.env.VITE_WS_BASE_URL;
  if (direct) return direct;

  const apiBase = import.meta.env.VITE_API_BASE_URL || "";
  if (!apiBase) return "";

  const normalized = apiBase.replace(/\/$/, "");
  const withoutApi = normalized.endsWith("/api")
    ? normalized.slice(0, -4)
    : normalized;

  return withoutApi.replace(/^http/i, "ws") + DEFAULT_PATH;
};

const scheduleReconnect = () => {
  if (sharedState.reconnectTimer) return;

  const delay = Math.min(
    MAX_RECONNECT_DELAY_MS,
    BASE_RECONNECT_DELAY_MS * Math.pow(2, sharedState.reconnectAttempt),
  );

  sharedState.reconnectTimer = window.setTimeout(() => {
    sharedState.reconnectTimer = null;
    sharedState.reconnectAttempt += 1;
    connect();
  }, delay);
};

const resetReconnect = () => {
  sharedState.reconnectAttempt = 0;
  if (sharedState.reconnectTimer) {
    clearTimeout(sharedState.reconnectTimer);
    sharedState.reconnectTimer = null;
  }
};

const handleMessage = (event) => {
  try {
    const payload = JSON.parse(event.data);

    if (payload?.type === "snapshot" && payload.data) {
      sharedState.ticks = new Map(Object.entries(payload.data));
      sharedState.candles = new Map(Object.entries(payload.candles || {}));
      notifyListeners();
      return;
    }

    if (payload?.type === "ticker") {
      const symbol = String(payload.product_id || "").toUpperCase();
      const price = Number(payload.price);
      const time = Number(payload.time || Date.now());
      if (!symbol || !Number.isFinite(price)) return;

      sharedState.ticks.set(symbol, { symbol, price, time });
      notifyListeners();
      return;
    }

    if (payload?.type === "candle" && payload.data) {
      const symbol = String(payload.product_id || "").toUpperCase();
      if (!symbol) return;
      sharedState.candles.set(symbol, payload.data);
      notifyListeners();
    }
  } catch (err) {
    // Abaikan payload non-JSON.
  }
};

const connect = () => {
  if (sharedState.status === "connecting" || sharedState.status === "open") {
    return;
  }

  const url = resolveWsUrl();
  if (!url) return;

  sharedState.status = "connecting";
  const ws = new WebSocket(url);
  sharedState.ws = ws;

  ws.onopen = () => {
    sharedState.status = "open";
    resetReconnect();
    notifyListeners();
  };

  ws.onmessage = handleMessage;

  ws.onclose = () => {
    sharedState.status = "closed";
    sharedState.ws = null;
    notifyListeners();
    scheduleReconnect();
  };

  ws.onerror = () => {
    sharedState.status = "error";
    notifyListeners();
    try {
      ws.close();
    } catch (err) {
      // Abaikan error close.
    }
  };
};

const disconnectIfIdle = () => {
  if (sharedState.listeners.size > 0) return;

  if (sharedState.ws) {
    try {
      sharedState.ws.close();
    } catch (err) {
      // Abaikan error close.
    }
  }

  sharedState.ws = null;
  sharedState.status = "idle";
  resetReconnect();
};

export const useCryptoWebSocket = () => {
  const [ticks, setTicks] = useState(() =>
    Object.fromEntries(sharedState.ticks.entries()),
  );
  const [candles, setCandles] = useState(() =>
    Object.fromEntries(sharedState.candles.entries()),
  );
  const [status, setStatus] = useState(sharedState.status);
  const listenerRef = useRef(null);

  useEffect(() => {
    if (!listenerRef.current) {
      listenerRef.current = (nextTicks, nextCandles, nextStatus) => {
        setTicks(nextTicks);
        setCandles(nextCandles);
        setStatus(nextStatus);
      };
    }

    sharedState.listeners.add(listenerRef.current);
    connect();

    return () => {
      if (listenerRef.current) {
        sharedState.listeners.delete(listenerRef.current);
      }
      disconnectIfIdle();
    };
  }, []);

  const isConnected = status === "open";

  return useMemo(
    () => ({
      ticks,
      candles,
      status,
      isConnected,
    }),
    [ticks, candles, status, isConnected],
  );
};

export default useCryptoWebSocket;
