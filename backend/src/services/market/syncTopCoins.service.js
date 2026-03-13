import axios from "axios";
import dotenv from "dotenv";
import { prisma } from "../../lib/prisma.js";
import { cleanTopCoinData } from "../../utils/dataCleaner.js";
import { fetchPairs } from "./coinbase.service.js";
import { fetchEarliestCandle } from "../coinbase/coinbase.service.js";

dotenv.config();

const CMC_BASE_URL =
  process.env.CMC_API_URL || "https://pro-api.coinmarketcap.com/v1";

export async function syncTopCoins() {
  try {
    if (!process.env.CMC_API_KEY)
      throw new Error("CMC_API_KEY tidak ditemukan di .env");

    // 1. Ambil Top 50 dari CMC (buffer lebih banyak untuk filtering)
    console.log("📥 Fetching top 50 coins from CoinMarketCap...");
    const { data } = await axios.get(
      `${CMC_BASE_URL}/cryptocurrency/listings/latest`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": process.env.CMC_API_KEY,
          Accept: "application/json",
        },
        params: { start: 1, limit: 50, convert: "USD", sort: "market_cap" },
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

    // 3. Filter: Cutoff date untuk analisis (bukan untuk menyimpan)
    const cutoffDate = new Date("2025-01-01T00:00:00.000Z");

    // 4. Pairing + Check Earliest Candle
    const allCoins = []; // Semua coin yang ditemukan (untuk disimpan)
    const validCoins = []; // Hanya coin dengan listing < 2025 (untuk analisis)

    for (const coin of coins) {
      // Stop mencari coin baru jika sudah dapat 20 valid coins
      if (validCoins.length >= 20) break;

      // Coba berbagai kemungkinan pair format
      const possiblePairs = [
        `${coin.symbol}-USD`,
        `${coin.symbol}-USDT`,
        `${coin.symbol}-EUR`,
        `${coin.symbol}-USDC`,
      ];

      const foundPair = possiblePairs.find((p) => activePairs.has(p));

      if (!foundPair) {
        console.log(`⏭️  ${coin.symbol}: No pair found on Coinbase`);
        continue;
      }

      // Cek apakah coin sudah pernah dicek sebelumnya (ada di database)
      const existingCoin = await prisma.coin.findFirst({
        where: { symbol: foundPair },
        select: { listingDate: true, symbol: true },
      });

      if (existingCoin) {
        // Coin sudah pernah dicek, gunakan data yang ada
        const isValid =
          existingCoin.listingDate && existingCoin.listingDate < cutoffDate;

        if (isValid) {
          console.log(
            `${foundPair}: Already checked, valid for analysis (${validCoins.length + 1}/20)`
          );
          validCoins.push({
            ...coin,
            symbol: foundPair,
            listingDate: existingCoin.listingDate,
          });
        } else {
          console.log(
            `${foundPair}: Already checked, not valid for analysis (listed ${existingCoin.listingDate?.toISOString().split("T")[0] || "never"})`
          );
        }

        // Tetap masukkan ke allCoins untuk update data CMC terbaru
        allCoins.push({
          ...coin,
          symbol: foundPair,
          listingDate: existingCoin.listingDate,
        });

        continue;
      }

      // Coin belum pernah dicek, fetch earliest candle
      console.log(`${foundPair}: Checking earliest candle...`);
      const earliestCandle = await fetchEarliestCandle(foundPair);

      let listingDate = null;
      if (earliestCandle) {
        listingDate = new Date(earliestCandle.time);
      }

      // Fetch logo dari CMC untuk coin ini
      let logo = null;
      try {
        const baseSymbol = foundPair.split("-")[0];
        const { data: infoData } = await axios.get(
          "https://pro-api.coinmarketcap.com/v2/cryptocurrency/info",
          {
            headers: {
              "X-CMC_PRO_API_KEY": process.env.CMC_API_KEY,
              Accept: "application/json",
            },
            params: { symbol: baseSymbol },
            timeout: 10000,
          }
        );
        logo = infoData?.data?.[baseSymbol]?.[0]?.logo || null;
      } catch (logoErr) {
        console.warn(`⚠️  Failed to fetch logo for ${foundPair}`);
      }

      // Simpan ke allCoins
      const coinData = {
        ...coin,
        symbol: foundPair,
        listingDate: listingDate,
        logo: logo, // ✅ Logo sudah ada
      };
      allCoins.push(coinData);

      if (!listingDate) {
        continue;
      }

      // Cek apakah valid untuk analisis
      if (listingDate < cutoffDate) {
        validCoins.push(coinData);
      } else {
        console.log(
          `${foundPair}: Too new for analysis (${listingDate.toISOString().split("T")[0]})`
        );
      }
    }

    if (allCoins.length === 0) {
      throw new Error("Tidak ada coin yang bisa dipair dengan Coinbase");
    }

    // 5. Ambil logo dari CMC API v2/cryptocurrency/info
    const baseSymbols = allCoins.map((c) => c.symbol.split("-")[0]);
    const symbolsParam = [...new Set(baseSymbols)].join(",");
    let coinsWithLogo = allCoins;

    try {
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

      if (infoData?.data) {
        coinsWithLogo = allCoins.map((coin) => {
          const baseSymbol = coin.symbol.split("-")[0];
          const coinInfo = infoData.data[baseSymbol]?.[0];
          return {
            ...coin,
            logo: coinInfo?.logo || null,
          };
        });
      }
    } catch (logoErr) {
      console.warn("Failed to fetch logos, continuing without logos");
    }

    // 6. DELETE semua TopCoin yang rank > 30
    const oldTopCoins = await prisma.topCoin.findMany({
      include: { coin: true },
    });

    const coinsToDelete = oldTopCoins.filter(
      (tc) => tc.coin.rank && tc.coin.rank > 30
    );

    for (const tc of coinsToDelete) {
      await prisma.topCoin.delete({ where: { id: tc.id } });
      console.log(`Deleted: ${tc.coin.symbol} (rank ${tc.coin.rank})`);
    }

    // 7. Simpan SEMUA coin ke database (termasuk yang tidak valid untuk analisis)
    for (const coin of coinsWithLogo) {
      // Upsert ke tabel Coin
      const coinRecord = await prisma.coin.upsert({
        where: { symbol: coin.symbol },
        update: {
          rank: coin.rank,
          name: coin.name,
          logo: coin.logo,
          listingDate: coin.listingDate, // null jika tidak ada data
        },
        create: {
          symbol: coin.symbol,
          rank: coin.rank,
          name: coin.name,
          logo: coin.logo,
          listingDate: coin.listingDate, // null jika tidak ada data
        },
      });

      // Upsert ke tabel TopCoin
      const existingTopCoin = await prisma.topCoin.findFirst({
        where: { coinId: coinRecord.id },
      });

      if (existingTopCoin) {
        await prisma.topCoin.update({
          where: { id: existingTopCoin.id },
          data: {
            price: coin.price,
            marketCap: coin.marketCap,
            volume24h: coin.volume24h,
          },
        });
      } else {
        await prisma.topCoin.create({
          data: {
            coinId: coinRecord.id,
            price: coin.price,
            marketCap: coin.marketCap,
            volume24h: coin.volume24h,
          },
        });
      }
    }

    console.log(`\Sync completed: ${coinsWithLogo.length} coins saved`);
    console.log(`${validCoins.length} coins available for analysis\n`);

    return {
      success: true,
      message: `Sync berhasil: ${coinsWithLogo.length} coins saved, ${validCoins.length} valid for analysis`,
      total: coinsWithLogo.length,
      validCount: validCoins.length,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
