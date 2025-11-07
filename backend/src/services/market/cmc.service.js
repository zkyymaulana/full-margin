// src/services/market/cmc.service.js
import axios from "axios";
import dotenv from "dotenv";
import { prisma } from "../../lib/prisma.js";

dotenv.config();

const CMC_BASE_URL =
  process.env.CMC_API_URL || "https://pro-api.coinmarketcap.com/v1";

/**
 * 🔹 Sinkronisasi Top 100 Coin dari CoinMarketCap + update rank
 */
export async function syncTopCoins(limit = 100) {
  console.log(`🚀 Mengambil data Top ${limit} Coin dari CoinMarketCap...`);

  try {
    if (!process.env.CMC_API_KEY)
      throw new Error("❌ CMC_API_KEY tidak ditemukan di .env");

    // Ambil data dari CMC
    const { data } = await axios.get(
      `${CMC_BASE_URL}/cryptocurrency/listings/latest`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": process.env.CMC_API_KEY,
          Accept: "application/json",
        },
        params: { start: 1, limit, convert: "USD", sort: "market_cap" },
        timeout: 30000,
      }
    );

    if (!data?.data) throw new Error("Data dari CMC kosong.");

    const coins = data.data.map((c) => ({
      rank: c.cmc_rank,
      name: c.name,
      symbol: c.symbol.toUpperCase(),
      price: c.quote.USD.price,
      marketCap: c.quote.USD.market_cap,
      volume24h: c.quote.USD.volume_24h,
    }));

    // Simpan ke tabel TopCoin
    for (const coin of coins) {
      await prisma.topCoin.upsert({
        where: { symbol: coin.symbol },
        update: coin,
        create: coin,
      });
    }

    console.log(`✅ ${coins.length} coin disimpan ke TopCoin.`);

    // Langsung update rank untuk coin yang sudah ada di tabel Coin
    let updatedCount = 0;
    for (const coin of coins) {
      // Cari dengan berbagai kemungkinan format pair
      const possiblePairs = [
        `${coin.symbol}-USD`,
        `${coin.symbol}-USDT`,
        `${coin.symbol}-EUR`,
        `${coin.symbol}-USDC`,
      ];

      for (const pair of possiblePairs) {
        const updated = await prisma.coin.updateMany({
          where: { symbol: pair },
          data: { rank: coin.rank, name: coin.name },
        });

        if (updated.count > 0) {
          console.log(`✅ Rank ${coin.rank} diperbarui untuk ${pair}`);
          updatedCount++;
          break; // Keluar dari loop jika sudah ketemu dan update
        }
      }
    }

    console.log(`✅ Total ${updatedCount} coin berhasil diperbarui ranknya.`);
    return { success: true, total: updatedCount, coinsFromCMC: coins.length };
  } catch (err) {
    console.error("❌ Gagal sinkronisasi:", err.message);
    return { success: false, error: err.message };
  }
}
