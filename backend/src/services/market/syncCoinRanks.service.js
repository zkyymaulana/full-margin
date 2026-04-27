import { prisma } from "../../lib/prisma.js";
import { getTopCoins } from "../../clients/coinmarketcap.client.js";

// Fungsi untuk sinkronisasi ranking coin dari CMC ke database
export async function syncTopCoinRanksFromCmc(limit = 20) {
  try {
    // 1. Ambil data top coin dari CoinMarketCap
    const data = await getTopCoins(limit);
    if (!data?.data) throw new Error("Data CMC kosong");

    // 2. Buat mapping: SYMBOL → RANK
    // Contoh: BTC → 1, ETH → 2
    const rankMap = new Map(
      data.data.map((c) => [c.symbol.toUpperCase(), c.cmc_rank]),
    );

    // 3. Ambil semua coin dari database
    const coins = await prisma.coin.findMany({
      select: { id: true, symbol: true, rank: true },
    });

    let updated = 0;

    // 4. Loop setiap coin di database
    for (const coin of coins) {
      // Ambil base symbol (BTC-USD → BTC)
      const baseSymbol = coin.symbol.split("-")[0];

      // Ambil rank terbaru dari CMC
      const newRank = rankMap.get(baseSymbol);

      // Jika ada rank baru dan berbeda dari yang lama → update
      if (newRank && coin.rank !== newRank) {
        await prisma.coin.update({
          where: { id: coin.id },
          data: { rank: newRank },
        });

        updated++;
      }
    }

    // 5. Return hasil
    return {
      success: true,
      message: `Berhasil update ${updated} coin`,
      updated,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}
