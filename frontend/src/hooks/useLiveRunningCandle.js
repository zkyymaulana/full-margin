import { useEffect, useRef } from "react";

const TIMEFRAME_MS_MAP = {
  "1m": 60 * 1000,
  "3m": 3 * 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "8h": 8 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
};

const getTimeframeMs = (timeframe) => {
  if (TIMEFRAME_MS_MAP[timeframe]) return TIMEFRAME_MS_MAP[timeframe];

  const match = String(timeframe || "").match(/^(\d+)([mhd])$/i);
  if (!match) return TIMEFRAME_MS_MAP["1h"];

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (unit === "m") return amount * 60 * 1000;
  if (unit === "h") return amount * 60 * 60 * 1000;
  if (unit === "d") return amount * 24 * 60 * 60 * 1000;

  return TIMEFRAME_MS_MAP["1h"];
};

const floorToBucket = (timestampMs, timeframeMs) => {
  return Math.floor(timestampMs / timeframeMs) * timeframeMs;
};

const getLatestIndexByTime = (candles) => {
  let latestIndex = 0;
  let latestTime = Number(candles[0]?.time || 0);

  for (let i = 1; i < candles.length; i += 1) {
    const currentTime = Number(candles[i]?.time || 0);
    if (currentTime > latestTime) {
      latestTime = currentTime;
      latestIndex = i;
    }
  }

  return latestIndex;
};

const isDescendingOrder = (candles) => {
  if (candles.length < 2) return false;
  return Number(candles[0].time) > Number(candles[1].time);
};

export const useLiveRunningCandle = ({
  setCandles,
  timeframe,
  livePrice,
  liveOhlcv,
  tickKey,
  tickTimestampMs,
  enabled,
}) => {
  const frameRef = useRef(null);
  const pendingPriceRef = useRef(null);

  useEffect(() => {
    if (!enabled || !Number.isFinite(Number(livePrice))) {
      return;
    }

    pendingPriceRef.current = Number(livePrice);

    if (frameRef.current != null) {
      return;
    }

    // Batasi update ke repaint browser agar ringan saat data tick rapat.
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const price = pendingPriceRef.current;

      if (!Number.isFinite(price)) return;

      setCandles((prevCandles) => {
        if (!Array.isArray(prevCandles) || prevCandles.length === 0) {
          return prevCandles;
        }

        const timeframeMs = getTimeframeMs(timeframe);
        const effectiveTickTime = Number.isFinite(Number(tickTimestampMs))
          ? Number(tickTimestampMs)
          : Date.now();
        const activeBucketStart = floorToBucket(effectiveTickTime, timeframeMs);
        const descendingOrder = isDescendingOrder(prevCandles);
        const latestIndex = getLatestIndexByTime(prevCandles);
        const latest = prevCandles[latestIndex];
        const latestTime = Number(latest.time);
        const liveBucketTime = Number(liveOhlcv?.time);
        const hasLiveOhlcv =
          Number.isFinite(liveBucketTime) &&
          Number.isFinite(Number(liveOhlcv?.open)) &&
          Number.isFinite(Number(liveOhlcv?.high)) &&
          Number.isFinite(Number(liveOhlcv?.low)) &&
          Number.isFinite(Number(liveOhlcv?.close));

        if (!Number.isFinite(latestTime)) return prevCandles;

        const nextCandles = [...prevCandles];

        if (hasLiveOhlcv && liveBucketTime === latestTime) {
          const nextOpen = Number(liveOhlcv.open);
          const nextHigh = Number(liveOhlcv.high);
          const nextLow = Number(liveOhlcv.low);
          const nextClose = Number(liveOhlcv.close);

          if (
            Number(latest.open) === nextOpen &&
            Number(latest.high) === nextHigh &&
            Number(latest.low) === nextLow &&
            Number(latest.close) === nextClose &&
            latest.isLiveCandle === true
          ) {
            return prevCandles;
          }

          nextCandles[latestIndex] = {
            ...latest,
            open: nextOpen,
            high: nextHigh,
            low: nextLow,
            close: nextClose,
            volume: Number.isFinite(Number(liveOhlcv?.volume))
              ? Number(liveOhlcv.volume)
              : latest.volume,
            isLiveCandle: true,
          };

          return nextCandles;
        }

        if (latestTime < activeBucketStart) {
          const lockedLatest = { ...latest, isLiveCandle: false };
          nextCandles[latestIndex] = lockedLatest;

          const nextOpen = price;
          const nextCandle = {
            ...latest,
            time: String(activeBucketStart),
            open: nextOpen,
            high: nextOpen,
            low: nextOpen,
            close: nextOpen,
            volume: 0,
            isLiveCandle: true,
          };

          return descendingOrder
            ? [nextCandle, ...nextCandles]
            : [...nextCandles, nextCandle];
        }

        const nextHigh = Math.max(Number(latest.high), price);
        const nextLow = Math.min(Number(latest.low), price);
        const nextClose = price;

        if (
          Number(latest.high) === nextHigh &&
          Number(latest.low) === nextLow &&
          Number(latest.close) === nextClose &&
          latest.isLiveCandle === true
        ) {
          return prevCandles;
        }

        nextCandles[latestIndex] = {
          ...latest,
          high: nextHigh,
          low: nextLow,
          close: nextClose,
          isLiveCandle: true,
        };

        return nextCandles;
      });
    });

    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [
    enabled,
    livePrice,
    liveOhlcv,
    setCandles,
    tickKey,
    tickTimestampMs,
    timeframe,
  ]);
};

export default useLiveRunningCandle;
