// src/controllers/marketcap.controller.js
// Mengambil daftar 100 koin dari DB beserta candle terakhirnya.
import { prisma } from "../lib/prisma.js";

function convertBigIntToNumber(obj) {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? Number(value) : value
    )
  );
}

export async function getMarketcap(req, res) {
  try {
    const coins = await prisma.coin.findMany({
      include: { candles: { orderBy: { time: "desc" }, take: 1 } },
      orderBy: { id: "asc" },
      take: 100,
    });

    res.json({
      success: true,
      total: coins.length,
      data: convertBigIntToNumber(coins),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
