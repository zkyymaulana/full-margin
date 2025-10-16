import { prisma } from "../lib/prisma.js";
import { analyzeMultiIndicator } from "../services/signals/signal-analyzer.service.js";

export async function getSignals(req, res) {
  try {
    const symbol = (req.params.symbol || "BTC-USD").toUpperCase();
    const strategy = req.query.strategy || "multi";
    const limit = Math.min(2000, parseInt(req.query.limit) || 500);

    const indicators = await prisma.indicator.findMany({
      where: { symbol },
      orderBy: { time: "desc" }, // ✅ Data terbaru dulu
      take: limit,
    });

    if (indicators.length === 0) {
      return res.json({
        success: true,
        symbol,
        strategy,
        total: 0,
        data: [],
      });
    }

    const weights = { rsi: 3, macd: 2, ema20: 1, psar: 1, bb: 1, stoch: 2 };

    // ✅ PERBAIKAN: Generate signals dengan timestamp yang konsisten
    const signals = indicators.map((i) => ({
      time: Number(i.time).toString(), // ✅ Convert BigInt ke string milidetik (13 digit)
      signal: analyzeMultiIndicator(i, weights),
    }));

    // ✅ PERBAIKAN: Tidak perlu reverse karena sudah DESC dari database
    res.json({
      success: true,
      symbol,
      strategy,
      total: signals.length,
      data: signals, // ✅ Data sudah dalam urutan terbaru dulu
    });
  } catch (err) {
    console.error(`❌ getSignals error:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}
