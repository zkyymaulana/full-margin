import { prisma } from "../lib/prisma.js";
import { analyzeMultiIndicator } from "../services/signals/signal-analyzer.service.js";

export async function getSignals(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const strategy = req.query.strategy || "multi";
    const limit = Math.min(2000, parseInt(req.query.limit) || 500);

    const indicators = await prisma.indicator.findMany({
      where: { symbol },
      orderBy: { time: "desc" },
      take: limit,
    });

    const weights = { rsi: 3, macd: 2, ema20: 1, psar: 1, bb: 1, stoch: 2 };
    const signals = indicators.map((i) => ({
      time: i.time,
      signal: analyzeMultiIndicator(i, weights),
    }));

    res.json({
      success: true,
      symbol,
      strategy,
      total: signals.length,
      data: signals.reverse(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
