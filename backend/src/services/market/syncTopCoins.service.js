import axios from "axios";
import dotenv from "dotenv";
import { prisma } from "../../lib/prisma.js";
import { cleanTopCoinData } from "../../utils/dataCleaner.js";
import { fetchPairs } from "./coinbase.service.js";

dotenv.config();

const CMC_BASE_URL =
  process.env.CMC_API_URL || "https://pro-api.coinmarketcap.com/v1";

/**
 * Sinkronisasi Top 30 Coin dari CoinMarketCap
 * Pairing Top 20 dengan Coinbase
 * Simpan hanya 20 coin yang valid ke database
 */
export async function syncTopCoins() {
  try {
    if (!process.env.CMC_API_KEY)
      throw new Error("CMC_API_KEY tidak ditemukan di .env");

    // 1. Ambil Top 30 dari CMC
    const { data } = await axios.get(
      `${CMC_BASE_URL}/cryptocurrency/listings/latest`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": process.env.CMC_API_KEY,
          Accept: "application/json",
        },
        params: { start: 1, limit: 30, convert: "USD", sort: "market_cap" },
        timeout: 30000,
      }
    );

    if (!data?.data) throw new Error("Data dari CMC kosong.");

    const rawCoins = data.data.map((c) => ({
      rank: c.cmc_rank,
      name: c.name,
      symbol: c.symbol.toUpperCase(),
      price: c.quote.USD.price,
      marketCap: c.quote.USD.market_cap,
      volume24h: c.quote.USD.volume_24h,
    }));

    const coins = cleanTopCoinData(rawCoins);
    if (coins.length === 0)
      throw new Error("Tidak ada coin valid setelah data cleaning.");

    // 2. Ambil pair aktif dari Coinbase
    const activePairs = await fetchPairs();

    if (activePairs.size === 0) {
      throw new Error("Tidak ada pair aktif di Coinbase");
    }

    // 3. Pairing: Ambil maksimal 20 coin yang punya pair aktif di Coinbase
    const pairedCoins = [];

    for (const coin of coins) {
      const possiblePairs = [
        `${coin.symbol}-USD`,
        `${coin.symbol}-EUR`,
        `${coin.symbol}-USDT`,
        `${coin.symbol}-GBP`,
        `${coin.symbol}-USDC`,
      ];

      const foundPair = possiblePairs.find((p) => activePairs.has(p));

      if (foundPair) {
        pairedCoins.push({ ...coin, symbol: foundPair });
      }

      // Stop setelah dapat 20 coin
      if (pairedCoins.length === 20) break;
    }

    if (pairedCoins.length === 0) {
      throw new Error("Tidak ada coin yang bisa dipasangkan dengan Coinbase");
    }

    // 4. Ambil logo dari CMC API v2/cryptocurrency/info
    // Extract base symbols (BTC-USD → BTC)
    const baseSymbols = pairedCoins.map((c) => c.symbol.split("-")[0]);
    const symbolsParam = [...new Set(baseSymbols)].join(","); // Remove duplicates

    let coinsWithLogo = pairedCoins;

    try {
      // Gunakan v2 endpoint (bukan v1)
      const { data: infoData } = await axios.get(
        "https://pro-api.coinmarketcap.com/v2/cryptocurrency/info",
        {
          headers: {
            "X-CMC_PRO_API_KEY": process.env.CMC_API_KEY,
            Accept: "application/json",
          },
          params: { symbol: symbolsParam },
          timeout: 30000,
        }
      );

      // Map logo ke setiap coin
      coinsWithLogo = pairedCoins.map((coin) => {
        const baseSymbol = coin.symbol.split("-")[0];
        const coinInfo = infoData?.data?.[baseSymbol];

        // CMC API v2 returns array, ambil index [0]
        const logo =
          Array.isArray(coinInfo) && coinInfo.length > 0 && coinInfo[0]?.logo
            ? coinInfo[0].logo
            : null;

        if (logo) {
          console.log(`Logo found for ${baseSymbol}: ${logo}`);
        } else {
          console.warn(`No logo for ${baseSymbol}`);
        }

        return { ...coin, logo };
      });
    } catch (logoErr) {
      console.error(`❌ Failed to fetch logos:`, {
        message: logoErr.message,
        status: logoErr.response?.status,
        statusText: logoErr.response?.statusText,
        data: logoErr.response?.data,
      });
      console.warn(`   Continuing without logos...`);
      // Continue tanpa logo jika API gagal
      coinsWithLogo = pairedCoins.map((c) => ({ ...c, logo: null }));
    }

    // 5. DELETE semua coin dengan rank > 30 dari TopCoin table
    const deletedOldCoins = await prisma.topCoin.deleteMany({
      where: { rank: { gt: 30 } },
    });

    // 6. Simpan Top 20 ke database dengan logo
    let savedCount = 0;

    for (const coin of coinsWithLogo) {
      // Simpan ke tabel Coin dengan logo
      await prisma.coin.upsert({
        where: { symbol: coin.symbol },
        update: {
          rank: coin.rank,
          name: coin.name,
          logo: coin.logo, // Update logo
        },
        create: {
          symbol: coin.symbol,
          rank: coin.rank,
          name: coin.name,
          logo: coin.logo, // Simpan logo
        },
      });

      // Simpan ke TopCoin
      await prisma.topCoin.upsert({
        where: { symbol: coin.symbol },
        update: {
          rank: coin.rank,
          name: coin.name,
          price: coin.price,
          marketCap: coin.marketCap,
          volume24h: coin.volume24h,
        },
        create: {
          rank: coin.rank,
          name: coin.name,
          symbol: coin.symbol,
          price: coin.price,
          marketCap: coin.marketCap,
          volume24h: coin.volume24h,
        },
      });
      savedCount++;
    }

    return {
      success: true,
      total: savedCount,
      coinsFromCMC: coins.length,
      coinsPaired: pairedCoins.length,
      coinsWithLogo: coinsWithLogo.filter((c) => c.logo).length,
      coinsDeleted: deletedOldCoins.count,
    };
  } catch (err) {
    // Log detail error untuk debugging
    if (err.response) {
      console.error("Response status:", err.response.status);
      console.error(
        "Response data:",
        JSON.stringify(err.response.data, null, 2)
      );
    } else if (err.request) {
      console.error("No response received from CMC API");
    } else {
      console.error("Error details:", err);
    }

    return { success: false, error: err.message };
  }
}
