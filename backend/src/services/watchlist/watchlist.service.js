import { prisma } from "../../lib/prisma.js";

/**
 * Get all watchlist entries for a user, including coin details
 */
export async function getWatchlist(userId) {
  const entries = await prisma.userWatchlist.findMany({
    where: { userId },
    include: {
      coin: {
        select: {
          id: true,
          symbol: true,
          name: true,
          logo: true,
          rank: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return entries.map((e) => ({
    id: e.id,
    coinId: e.coinId,
    createdAt: e.createdAt,
    coin: e.coin,
  }));
}

/**
 * Add a coin to a user's watchlist (idempotent – ignores duplicates)
 */
export async function addToWatchlist(userId, coinId) {
  // Verify coin exists
  const coin = await prisma.coin.findUnique({ where: { id: coinId } });
  if (!coin) throw new Error(`Coin with id ${coinId} not found`);

  // upsert so duplicate calls are safe
  const entry = await prisma.userWatchlist.upsert({
    where: { userId_coinId: { userId, coinId } },
    update: {}, // nothing to update
    create: { userId, coinId },
    include: {
      coin: { select: { id: true, symbol: true, name: true, logo: true } },
    },
  });

  return entry;
}

/**
 * Remove a coin from a user's watchlist
 */
export async function removeFromWatchlist(userId, coinId) {
  const existing = await prisma.userWatchlist.findUnique({
    where: { userId_coinId: { userId, coinId } },
  });

  if (!existing) return null; // already not in watchlist – silently succeed

  await prisma.userWatchlist.delete({
    where: { userId_coinId: { userId, coinId } },
  });

  return { removed: true, coinId };
}

/**
 * Get all users watching a specific coin (used for Telegram notifications)
 */
export async function getWatchersForCoin(coinId) {
  return prisma.userWatchlist.findMany({
    where: { coinId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          telegramChatId: true,
          telegramEnabled: true,
        },
      },
    },
  });
}
