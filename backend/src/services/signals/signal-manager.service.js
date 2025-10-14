/**
 * 💾 signal-manager.service.js
 * Bertugas menyimpan, mengambil, dan menghitung statistik sinyal di database.
 */

import { prisma } from "../../lib/prisma.js";

export async function saveSignalToDB(
  userId,
  symbol,
  action,
  confidence,
  indicator = "MULTI_INDICATOR"
) {
  if (action === "HOLD") return null;

  try {
    const signal = await prisma.signal.create({
      data: {
        userId,
        symbol,
        indicator,
        action,
        confidence,
        createdAt: new Date(),
      },
    });
    return signal;
  } catch (err) {
    console.error("❌ Error saving signal:", err);
    throw err;
  }
}

export async function getRecentUserSignals(userId, symbol, limit = 10) {
  return prisma.signal.findMany({
    where: { userId, symbol },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getAllUserSignals(userId, limit = 50) {
  return prisma.signal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getLatestSymbolSignal(symbol) {
  return prisma.signal.findFirst({
    where: { symbol },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

export async function getSymbolSignalStats(symbol, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const signals = await prisma.signal.findMany({
    where: { symbol, createdAt: { gte: startDate } },
    orderBy: { createdAt: "desc" },
  });

  const stats = {
    total: signals.length,
    buy: signals.filter((s) => s.action === "BUY").length,
    sell: signals.filter((s) => s.action === "SELL").length,
    avgConfidence:
      signals.length > 0
        ? signals.reduce((sum, s) => sum + (s.confidence || 0), 0) /
          signals.length
        : 0,
  };

  return stats;
}
