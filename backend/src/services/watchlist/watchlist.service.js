import { prisma } from "../../lib/prisma.js";

// Ambil seluruh daftar watchlist milik user beserta detail coin.
export async function getWatchlist(userId) {
  // Query watchlist user dan join data coin yang dibutuhkan UI.
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

  // Bentuk response yang lebih rapi untuk frontend.
  return entries.map((e) => ({
    id: e.id,
    coinId: e.coinId,
    createdAt: e.createdAt,
    coin: e.coin,
  }));
}

// Tambahkan coin ke watchlist user secara aman (idempotent).
export async function addToWatchlist(userId, coinId) {
  // Pastikan coin yang diminta benar-benar ada.
  const coin = await prisma.coin.findUnique({ where: { id: coinId } });
  if (!coin) throw new Error(`Coin with id ${coinId} not found`);

  // Gunakan upsert agar request berulang tidak membuat duplikasi data.
  const entry = await prisma.userWatchlist.upsert({
    where: { userId_coinId: { userId, coinId } },
    update: {},
    create: { userId, coinId },
    include: {
      coin: { select: { id: true, symbol: true, name: true, logo: true } },
    },
  });

  return entry;
}

// Hapus coin dari watchlist user.
export async function removeFromWatchlist(userId, coinId) {
  // Cek dulu apakah relasi user-coin memang ada.
  const existing = await prisma.userWatchlist.findUnique({
    where: { userId_coinId: { userId, coinId } },
  });

  // Jika sudah tidak ada di watchlist, cukup return null.
  if (!existing) return null;

  await prisma.userWatchlist.delete({
    where: { userId_coinId: { userId, coinId } },
  });

  return { removed: true, coinId };
}

// Ambil daftar user yang sedang memantau coin tertentu.
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
