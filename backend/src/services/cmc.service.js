// src/services/cmc.service.js
// Mengambil data Top 100 coin dari CoinMarketCap dan menyimpannya ke tabel TopCoin.
import axios from "axios";
import dotenv from "dotenv";
import { prisma } from "../lib/prisma.js";

dotenv.config();

const CMC_BASE_URL =
  process.env.CMC_API_URL || "https://pro-api.coinmarketcap.com/v1";

/**
 * 🔹 Sinkronisasi data Top Coin dari CoinMarketCap
 * @param {number} limit - Jumlah aset yang akan diambil
 */
export async function syncTopCoins(limit = 200) {
  console.log(`🚀 Mengambil data Top ${limit} Coin dari CMC...`);

  try {
    const { data } = await axios.get(
      `${CMC_BASE_URL}/cryptocurrency/listings/latest`,
      {
        headers: { "X-CMC_PRO_API_KEY": process.env.CMC_API_KEY },
        params: { start: 1, limit, convert: "USD", sort: "market_cap" },
        timeout: 20000,
      }
    );

    if (!data?.data) throw new Error("Data dari CMC kosong.");

    const coins = data.data.map((coin) => ({
      rank: coin.cmc_rank,
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      price: coin.quote.USD.price,
      marketCap: coin.quote.USD.market_cap,
      volume24h: coin.quote.USD.volume_24h,
    }));

    let inserted = 0;
    let updated = 0;

    for (const coin of coins) {
      await prisma.topCoin.upsert({
        where: { symbol: coin.symbol },
        update: coin,
        create: coin,
      });
      inserted++;
    }

    console.log(`✅ Sync selesai: ${inserted} coin disimpan/diupdate`);
    return { success: true, total: inserted };
  } catch (err) {
    console.error(`❌ Gagal sinkronisasi CMC: ${err.message}`);
    return { success: false, error: err.message };
  }
}
