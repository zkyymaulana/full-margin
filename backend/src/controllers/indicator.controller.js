import { prisma } from "../lib/prisma.js";
import { calculateAndSaveIndicators } from "../services/indicators/indicator.service.js";

/* ===========================================================
   📊 SIGNAL ANALYZER HELPERS (Ringkas)
=========================================================== */
const signalAnalyzers = {
  sma: (s20, s50, p) =>
    !s20 || !s50 || !p
      ? "neutral"
      : p > s20 && p > s50 && s20 > s50
        ? "buy"
        : p < s20 && p < s50 && s20 < s50
          ? "sell"
          : "neutral",

  ema: (e20, e50, p) =>
    !e20 || !e50 || !p
      ? "neutral"
      : p > e20 && p > e50 && e20 > e50
        ? "buy"
        : p < e20 && p < e50 && e20 < e50
          ? "sell"
          : "neutral",

  rsi: (r) => (!r ? "neutral" : r > 70 ? "sell" : r < 30 ? "buy" : "neutral"),

  macd: (m, s, h) =>
    !m || !s || h == null
      ? "neutral"
      : m > s && h > 0
        ? "buy"
        : m < s && h < 0
          ? "sell"
          : "neutral",

  bb: (p, up, low) => {
    if (!p || !up || !low) return "neutral";
    const w = up - low;
    return p > up - w * 0.1 ? "sell" : p < low + w * 0.1 ? "buy" : "neutral";
  },

  stoch: (k, d) =>
    !k || !d
      ? "neutral"
      : k > 80 && d > 80
        ? "sell"
        : k < 20 && d < 20
          ? "buy"
          : "neutral",

  stochRsi: (k, d) =>
    !k || !d
      ? "neutral"
      : k > 80 && d > 80
        ? "sell"
        : k < 20 && d < 20
          ? "buy"
          : "neutral",

  psar: (p, ps) =>
    !p || !ps ? "neutral" : p > ps ? "buy" : p < ps ? "sell" : "neutral",
};

/* ===========================================================
   ✅ GET INDICATORS API (Ringkas & Cepat)
=========================================================== */
export async function getIndicators(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const timeframe = "1h";
    const limit = Math.min(10000, parseInt(req.query.limit) || 2000);

    // === Ambil indikator + candle secara paralel ===
    let [data, candles] = await Promise.all([
      prisma.indicator.findMany({
        where: { symbol, timeframe },
        orderBy: { time: "desc" },
        take: limit,
      }),
      prisma.candle.findMany({
        where: { symbol, timeframe },
        orderBy: { time: "desc" },
        take: limit,
      }),
    ]);

    // === Jika indikator kosong, hitung otomatis ===
    if (!data.length) {
      console.log(`📊 Tidak ada indikator untuk ${symbol}, menghitung...`);
      const count = await prisma.candle.count({ where: { symbol, timeframe } });
      if (!count)
        return res.status(400).json({
          success: false,
          message: `Tidak ada candle data untuk ${symbol}.`,
        });

      await calculateAndSaveIndicators(symbol, timeframe, "full");
      data = await prisma.indicator.findMany({
        where: { symbol, timeframe },
        orderBy: { time: "desc" },
        take: limit,
      });
      candles = await prisma.candle.findMany({
        where: { symbol, timeframe },
        orderBy: { time: "desc" },
        take: limit,
      });
      console.log(`✅ ${symbol}: ${data.length} indikator berhasil dihitung.`);
    }

    // === Map candle agar lookup cepat ===
    const candleMap = new Map(candles.map((c) => [c.time.toString(), c.close]));

    // === Format response ringkas ===
    const organized = data.map((d) => {
      const price = candleMap.get(d.time.toString()) ?? null;
      return {
        time: Number(d.time),
        price,
        indicators: {
          sma: {
            20: d.sma20,
            50: d.sma50,
            signal: signalAnalyzers.sma(d.sma20, d.sma50, price),
          },
          ema: {
            20: d.ema20,
            50: d.ema50,
            signal: signalAnalyzers.ema(d.ema20, d.ema50, price),
          },
          rsi: {
            14: d.rsi,
            signal: signalAnalyzers.rsi(d.rsi),
          },
          macd: {
            fast: 12,
            slow: 26,
            signalPeriod: 9,
            macd: d.macd,
            signalLine: d.macdSignal,
            histogram: d.macdHist,
            signal: signalAnalyzers.macd(d.macd, d.macdSignal, d.macdHist),
          },
          bollingerBands: {
            upper: d.bbUpper,
            lower: d.bbLower,
            signal: signalAnalyzers.bb(price, d.bbUpper, d.bbLower),
          },
          stochastic: {
            "%K": d.stochK,
            "%D": d.stochD,
            signal: signalAnalyzers.stoch(d.stochK, d.stochD),
          },
          stochasticRsi: {
            "%K": d.stochRsiK,
            "%D": d.stochRsiD,
            signal: signalAnalyzers.stochRsi(d.stochRsiK, d.stochRsiD),
          },
          parabolicSar: {
            value: d.psar,
            signal: signalAnalyzers.psar(price, d.psar),
          },
        },
      };
    });

    // === Kirim response ===
    res.json({
      success: true,
      symbol,
      timeframe,
      totalData: organized.length,
      data: organized,
    });
  } catch (err) {
    console.error("❌ getIndicators error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}
