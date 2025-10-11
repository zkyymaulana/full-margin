import { prisma } from "../lib/prisma.js";

// Save a trading signal to the database
export async function saveSignal(
  userId,
  symbol,
  action,
  confidence,
  indicator = "MULTI_INDICATOR"
) {
  try {
    // Only save if action is not HOLD
    if (action === "HOLD") {
      return null;
    }

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
  } catch (error) {
    console.error("Error saving signal:", error);
    throw error;
  }
}

// Get recent signals for a user and symbol
export async function getRecentSignals(userId, symbol, limit = 10) {
  try {
    const signals = await prisma.signal.findMany({
      where: {
        userId,
        symbol,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });
    return signals;
  } catch (error) {
    console.error("Error getting recent signals:", error);
    throw error;
  }
}

// Get all signals for a user
export async function getUserSignals(userId, limit = 50) {
  try {
    const signals = await prisma.signal.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });
    return signals;
  } catch (error) {
    console.error("Error getting user signals:", error);
    throw error;
  }
}

// Get latest signal for a symbol (across all users)
export async function getLatestSignalForSymbol(symbol) {
  try {
    const signal = await prisma.signal.findFirst({
      where: {
        symbol,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    return signal;
  } catch (error) {
    console.error("Error getting latest signal for symbol:", error);
    throw error;
  }
}

// Get signal statistics for a symbol
export async function getSignalStats(symbol, days = 7) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const signals = await prisma.signal.findMany({
      where: {
        symbol,
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
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
  } catch (error) {
    console.error("Error getting signal stats:", error);
    throw error;
  }
}
