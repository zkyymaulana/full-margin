import { prisma } from "../../lib/prisma.js";

/* ===========================================================
   📊 TECHNICAL INDICATORS SERVICE (Optimized Clean Version)
   - SMA, EMA, RSI, MACD, BB, Stoch, StochRSI, PSAR
   - Rolling window + incremental calculation
=========================================================== */

// === Core Helpers ===
const SMA = (arr, n) =>
  arr.length < n ? null : arr.slice(-n).reduce((a, b) => a + b, 0) / n;

const EMA = (price, prev, n) =>
  prev == null ? price : price * (2 / (n + 1)) + prev * (1 - 2 / (n + 1));

const RSI = (prices, n = 14) => {
  if (prices.length < n + 1) return null;
  let gains = 0,
    losses = 0;
  for (let i = 1; i <= n; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0) gains += d;
    else losses += -d;
  }
  let avgG = gains / n,
    avgL = losses / n;
  for (let i = n + 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    avgG = (avgG * (n - 1) + Math.max(d, 0)) / n;
    avgL = (avgL * (n - 1) + Math.max(-d, 0)) / n;
  }
  if (avgL === 0) return 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
};

// === MACD ===
const MACD = (price, prev12, prev26, prevSignal) => {
  const ema12 = EMA(price, prev12, 12);
  const ema26 = EMA(price, prev26, 26);
  if (!ema12 || !ema26)
    return { macd: null, signal: null, hist: null, ema12, ema26 };
  const macd = ema12 - ema26;
  const signal = EMA(macd, prevSignal, 9);
  return { macd, signal, hist: signal ? macd - signal : null, ema12, ema26 };
};

// === Bollinger Bands ===
const BB = (prices, n = 20, k = 2) => {
  if (prices.length < n) return { upper: null, lower: null };
  const mean = SMA(prices, n);
  const std = Math.sqrt(
    prices.slice(-n).reduce((s, p) => s + (p - mean) ** 2, 0) / n
  );
  return { upper: mean + k * std, lower: mean - k * std };
};

// === Stochastic Oscillator ===
const Stoch = (h, l, c, n = 14, dN = 3, prevK = []) => {
  if (h.length < n || l.length < n) return { k: null, d: null };
  const hh = Math.max(...h.slice(-n));
  const ll = Math.min(...l.slice(-n));
  const k = ((c[c.length - 1] - ll) / (hh - ll)) * 100;
  const d = SMA([...prevK.slice(-dN + 1), k], dN);
  return { k, d };
};

// === Stochastic RSI ===
const StochRSI = (prices, rsiN = 14, stochN = 14, kN = 3, dN = 3) => {
  if (prices.length < rsiN + stochN + 3) return { k: null, d: null };
  const rsiVals = [];
  for (let i = rsiN; i < prices.length; i++) {
    const slice = prices.slice(i - rsiN, i + 1);
    const rsi = RSI(slice, rsiN);
    if (rsi != null) rsiVals.push(rsi);
  }
  if (rsiVals.length < stochN) return { k: null, d: null };
  const rsiWin = rsiVals.slice(-stochN);
  const high = Math.max(...rsiWin),
    low = Math.min(...rsiWin),
    cur = rsiVals.at(-1);
  const k = ((cur - low) / (high - low)) * 100;
  const d = SMA([...rsiVals.slice(-dN), k], dN);
  return { k, d };
};

// === Parabolic SAR (simplified incremental) ===
const PSAR = (highs, lows, step = 0.02, max = 0.2) => {
  if (highs.length < 2) return null;
  let sar = lows[0],
    up = true,
    af = step,
    ep = highs[0];
  for (let i = 1; i < highs.length; i++) {
    const psarPrev = sar;
    sar = psarPrev + af * (ep - psarPrev);
    sar = up ? Math.min(sar, lows[i - 1]) : Math.max(sar, highs[i - 1]);
    if (up) {
      if (lows[i] <= sar) {
        up = false;
        sar = ep;
        af = step;
        ep = lows[i];
      } else if (highs[i] > ep) {
        ep = highs[i];
        af = Math.min(af + step, max);
      }
    } else {
      if (highs[i] >= sar) {
        up = true;
        sar = ep;
        af = step;
        ep = highs[i];
      } else if (lows[i] < ep) {
        ep = lows[i];
        af = Math.min(af + step, max);
      }
    }
  }
  return sar;
};

// === Main Function ===
export async function calculateAndSaveIndicators(symbol, timeframe = "1h") {
  console.log(`📊 Calculating indicators for ${symbol}...`);
  const start = Date.now();
  const [candles, existing] = await Promise.all([
    prisma.candle.findMany({
      where: { symbol, timeframe },
      orderBy: { time: "asc" },
    }),
    prisma.indicator.findMany({
      where: { symbol, timeframe },
      orderBy: { time: "asc" },
    }),
  ]);
  if (!candles.length) return console.log("No candles found.");

  const existingTimes = new Set(existing.map((i) => i.time.toString()));
  const startIdx = existing.length
    ? candles.findIndex((c) => c.time === existing.at(-1).time) + 1
    : 0;
  if (startIdx >= candles.length) return console.log("Already up to date.");

  let ema20 = null,
    ema50 = null,
    ema12 = null,
    ema26 = null,
    sig = null;
  const closes = [],
    highs = [],
    lows = [],
    out = [],
    prevK = [];

  for (let i = 0; i < candles.length; i++) {
    const { close, high, low, time } = candles[i];
    closes.push(close);
    highs.push(high);
    lows.push(low);
    if (i < 50) continue;

    const sma20 = SMA(closes, 20),
      sma50 = SMA(closes, 50);
    ema20 = EMA(close, ema20, 20);
    ema50 = EMA(close, ema50, 50);
    const macd = MACD(close, ema12, ema26, sig);
    ema12 = macd.ema12;
    ema26 = macd.ema26;
    sig = macd.signal;
    const rsi = RSI(closes.slice(-15), 14);
    const bb = BB(closes);
    const st = Stoch(highs, lows, closes, 14, 3, prevK);
    if (st.k != null) prevK.push(st.k);
    const srsi = StochRSI(closes);
    const psar = PSAR(highs.slice(-50), lows.slice(-50));

    out.push({
      symbol,
      timeframe,
      time,
      sma20,
      sma50,
      ema20,
      ema50,
      rsi,
      macd: macd.macd,
      macdSignal: macd.signal,
      macdHist: macd.hist,
      bbUpper: bb.upper,
      bbLower: bb.lower,
      stochK: st.k,
      stochD: st.d,
      stochRsiK: srsi.k,
      stochRsiD: srsi.d,
      psar,
    });
  }

  await prisma.indicator.createMany({
    data: out.slice(startIdx),
    skipDuplicates: true,
  });
  console.log(
    `✅ ${symbol}: ${out.length} indicators saved (${Date.now() - start}ms)`
  );
}

export async function getRecentIndicators(
  symbol,
  limit = 2000,
  timeframe = "1h"
) {
  return prisma.indicator.findMany({
    where: { symbol, timeframe },
    orderBy: { time: "desc" },
    take: limit,
  });
}
