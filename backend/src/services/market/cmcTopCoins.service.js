import axios from "axios";
import dotenv from "dotenv";
import { prisma } from "../../lib/prisma.js";
import { cleanTopCoinData } from "../../utils/dataCleaner.js";
import { fetchPairs } from "./coinbase.service.js";

dotenv.config();

const CMC_BASE_URL =
  process.env.CMC_API_URL || "https://pro-api.coinmarketcap.com/v1";

/**
 * 📊 Sinkronisasi Top 30 Coin dari CoinMarketCap
 * 🔗 Pairing Top 20 dengan Coinbase
 * ✨ Simpan hanya 20 coin yang valid ke database
 */
export async function syncTopCoins() {
  console.log("📊 Fetching Top 30 From CoinMarketCap...");

  try {
    if (!process.env.CMC_API_KEY)
      throw new Error("CMC_API_KEY tidak ditemukan di .env");

    // 🎯 1. Ambil Top 30 dari CMC
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

    console.log(`✅ Fetched ${coins.length} coins from CMC (Top 30)`);

    // 🎯 2. Ambil pair aktif dari Coinbase
    console.log("🔗 Matching 20 coins with Coinbase pairs...");
    const activePairs = await fetchPairs();

    if (activePairs.size === 0) {
      throw new Error("Tidak ada pair aktif di Coinbase");
    }

    // 🎯 3. Pairing: Ambil maksimal 20 coin yang punya pair aktif di Coinbase
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

      // 🛑 Stop setelah dapat 20 coin
      if (pairedCoins.length === 20) break;
    }

    if (pairedCoins.length === 0) {
      throw new Error("Tidak ada coin yang bisa dipasangkan dengan Coinbase");
    }

    console.log(`✅ Found ${pairedCoins.length} coins paired with Coinbase`);

    // 🎯 4. Ambil logo dari CMC API v2/cryptocurrency/info
    console.log("🖼️ Fetching logos from CoinMarketCap...");

    // Extract base symbols (BTC-USD → BTC)
    const baseSymbols = pairedCoins.map((c) => c.symbol.split("-")[0]);
    const symbolsParam = [...new Set(baseSymbols)].join(","); // Remove duplicates

    let coinsWithLogo = pairedCoins;

    try {
      // ✅ FIX: Gunakan v2 endpoint (bukan v1)
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

      console.log(`🔍 [Debug] CMC Info API response structure:`, {
        hasData: !!infoData?.data,
        symbols: Object.keys(infoData?.data || {}),
      });

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
          console.log(`✅ Logo found for ${baseSymbol}: ${logo}`);
        } else {
          console.warn(`⚠️ No logo for ${baseSymbol}`);
        }

        return { ...coin, logo };
      });

      const withLogo = coinsWithLogo.filter((c) => c.logo).length;
      console.log(
        `✅ Fetched ${withLogo}/${pairedCoins.length} logos from CMC`
      );
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

    // 🎯 5. DELETE semua coin dengan rank > 30 dari TopCoin table
    console.log("🧹 Deleting TopCoin records with rank > 30...");
    const deletedOldCoins = await prisma.topCoin.deleteMany({
      where: { rank: { gt: 30 } },
    });
    console.log(`🗑️ Deleted ${deletedOldCoins.count} old coins (rank > 30)`);

    // 🎯 6. Simpan Top 20 ke database dengan logo
    console.log("✨ Saving Top 20 Coins with logos to Database...");
    let savedCount = 0;

    for (const coin of coinsWithLogo) {
      // ✅ Simpan ke tabel Coin dengan logo
      await prisma.coin.upsert({
        where: { symbol: coin.symbol },
        update: {
          rank: coin.rank,
          name: coin.name,
          logo: coin.logo, // ✅ Update logo
        },
        create: {
          symbol: coin.symbol,
          rank: coin.rank,
          name: coin.name,
          logo: coin.logo, // ✅ Simpan logo
        },
      });

      // ✅ Simpan ke TopCoin
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

    console.log(`💾 Saved ${savedCount} coins to Coin table (with logos)`);
    console.log(`💾 Saved ${savedCount} coins to TopCoin table`);

    console.log("\n🎉 Sync completed successfully!");
    console.log(`📊 Fetched Top 30 From CoinMarketCap`);
    console.log(`🔗 Paired Top 20 With Coinbase`);
    console.log(
      `🖼️ Fetched logos for ${coinsWithLogo.filter((c) => c.logo).length} coins`
    );
    console.log(`✨ Saved ${savedCount} Coins to Database`);
    console.log(`🧹 Deleted coins ranked > 30 from TopCoin table`);

    return {
      success: true,
      total: savedCount,
      coinsFromCMC: coins.length,
      coinsPaired: pairedCoins.length,
      coinsWithLogo: coinsWithLogo.filter((c) => c.logo).length,
      coinsDeleted: deletedOldCoins.count,
    };
  } catch (err) {
    console.error("❌ Sync error:", err.message);

    // Log detail error untuk debugging
    if (err.response) {
      console.error("📋 Response status:", err.response.status);
      console.error(
        "📋 Response data:",
        JSON.stringify(err.response.data, null, 2)
      );
    } else if (err.request) {
      console.error("📋 No response received from CMC API");
    } else {
      console.error("📋 Error details:", err);
    }

    return { success: false, error: err.message };
  }
}
