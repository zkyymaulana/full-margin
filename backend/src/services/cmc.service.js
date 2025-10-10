import axios from "axios";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();
const prisma = new PrismaClient();

const CMC_BASE_URL =
  process.env.CMC_API_URL || "https://pro-api.coinmarketcap.com/v1";

/**
 * 🔹 Sinkronisasi aset dari CMC (default 200 aset)
 *    - Jika simbol belum ada di database → buat baru
 *    - Jika simbol sudah ada → update data harga, volume, marketcap
 */
export async function syncTopCoins(limit = 200) {
  console.log(`🚀 Mengambil data Top ${limit} dari CoinMarketCap...`);

  try {
    const { data } = await axios.get(
      `${CMC_BASE_URL}/cryptocurrency/listings/latest`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": process.env.CMC_API_KEY,
        },
        params: {
          start: 1,
          limit,
          convert: "USD",
          sort: "market_cap",
        },
        timeout: 20000,
      }
    );

    if (!data?.data) {
      console.warn("⚠️ Tidak ada data yang diterima dari CMC!");
      return;
    }

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
      const existing = await prisma.topCoin.findUnique({
        where: { symbol: coin.symbol },
      });

      if (existing) {
        // Jika sudah ada, update data terbaru
        await prisma.topCoin.update({
          where: { symbol: coin.symbol },
          data: {
            rank: coin.rank,
            name: coin.name,
            price: coin.price,
            marketCap: coin.marketCap,
            volume24h: coin.volume24h,
          },
        });
        updated++;
      } else {
        // Jika belum ada, simpan baru
        await prisma.topCoin.create({ data: coin });
        inserted++;
      }
    }

    console.log(
      `✅ Sync selesai: ${inserted} coin baru disimpan, ${updated} coin diperbarui`
    );
  } catch (err) {
    if (err.response) {
      console.error(
        `❌ Gagal mengambil data dari CMC: [${err.response.status}] ${err.response.statusText}`
      );
    } else {
      console.error(`❌ Gagal mengambil data dari CMC: ${err.message}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}
