import dotenv from "dotenv";
import { prisma } from "../../lib/prisma.js";
import { cleanTopCoinData } from "../../utils/dataCleaner.js";
import {
  fetchPairs,
  fetchEarliestCandle,
} from "../../clients/coinbase.client.js";
import {
  getTopCoins,
  getCoinLogos,
} from "../../clients/coinmarketcap.client.js";

dotenv.config();

const TARGET_VALID_COINS = 20;
const LISTING_CUTOFF_DATE = new Date("2025-01-01T00:00:00.000Z");
const SAFE_FALLBACK_LISTING_DATE = new Date("2000-01-01T00:00:00.000Z");

function toDateLabel(dateValue) {
  return dateValue?.toISOString().split("T")[0] || "never";
}

// Sinkronisasi top coin dari CMC, padankan pair Coinbase, lalu simpan ke database.
export async function syncTopCoins() {
  try {
    // Simpan per coin secara incremental agar aman saat proses terhenti di tengah.
    const upsertCoinAndTopCoin = async (coin) => {
      const updateData = {
        rank: coin.rank,
        name: coin.name,
        listingDate: coin.listingDate,
      };

      // Jangan override logo lama jika coin saat ini tidak membawa logo.
      if (coin.logo !== undefined) {
        updateData.logo = coin.logo;
      }

      const createData = {
        symbol: coin.symbol,
        rank: coin.rank,
        name: coin.name,
        listingDate: coin.listingDate,
      };

      if (coin.logo !== undefined) {
        createData.logo = coin.logo;
      }

      const coinRecord = await prisma.coin.upsert({
        where: { symbol: coin.symbol },
        update: updateData,
        create: createData,
      });

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
    };

    // 1. Ambil Top 50 dari CMC (buffer lebih banyak untuk filtering)
    console.log("📥 Fetching top 50 coins from CoinMarketCap...");

    // Semua HTTP request berada di client
    const data = await getTopCoins(50);

    if (!data?.data) throw new Error("Data dari CMC kosong.");

    const rawCoins = data.data.map((c) => ({
      rank: c.cmc_rank,
      name: c.name,
      symbol: c.symbol.toUpperCase(),
      price: c.quote.USD.price,
      marketCap: c.quote.USD.market_cap,
      volume24h: c.quote.USD.volume_24h,
      cmcListingDate: c.date_added ? new Date(c.date_added) : null,
    }));

    const coins = cleanTopCoinData(rawCoins);
    if (coins.length === 0)
      throw new Error("Tidak ada coin valid setelah data cleaning.");

    // 2. Ambil pair aktif dari Coinbase (via client)
    const activePairs = await fetchPairs();

    if (activePairs.size === 0) {
      throw new Error("Tidak ada pair aktif di Coinbase");
    }

    // 3. Filter: Cutoff date untuk analisis (bukan untuk menyimpan)
    // 4. Pairing + Check Earliest Candle
    let savedCount = 0;
    const validCoins = []; // Hanya coin dengan listing < 2025 (untuk analisis)
    let processedCount = 0;
    const syncedSymbols = new Set();
    const incomingRanks = new Set(
      coins.map((c) => c.rank).filter((r) => r != null),
    );

    coinLoop: for (const coin of coins) {
      processedCount++;

      // Stop mencari coin baru jika sudah dapat 20 valid coins
      if (validCoins.length >= TARGET_VALID_COINS) break;

      // Coba berbagai kemungkinan pair format
      const possiblePairs = [
        `${coin.symbol}-USD`,
        `${coin.symbol}-USDT`,
        `${coin.symbol}-EUR`,
        `${coin.symbol}-USDC`,
      ];

      const foundPair = possiblePairs.find((p) => activePairs.has(p));

      if (!foundPair) {
        console.log(
          `[${processedCount}/${coins.length}] ⏭️  ${coin.symbol}: No pair found on Coinbase`,
        );
        continue;
      }

      // Cek apakah coin sudah pernah dicek sebelumnya (ada di database)
      const existingCoin = await prisma.coin.findFirst({
        where: { symbol: foundPair },
        select: { listingDate: true, symbol: true },
      });

      if (existingCoin) {
        let resolvedListingDate = existingCoin.listingDate;

        // Backfill listingDate lama yang masih null agar tidak fetch ulang di run berikutnya.
        if (!resolvedListingDate) {
          console.log(
            `[${processedCount}/${coins.length}] ${foundPair}: listingDate kosong, checking earliest candle...`,
          );

          const earliestCandle = await fetchEarliestCandle(foundPair);

          if (earliestCandle) {
            resolvedListingDate = new Date(earliestCandle.time);
          } else if (coin.cmcListingDate) {
            resolvedListingDate = coin.cmcListingDate;
            console.log(
              `[${processedCount}/${coins.length}] ${foundPair}: fallback listingDate from CMC (${resolvedListingDate.toISOString().split("T")[0]})`,
            );
          } else {
            resolvedListingDate = SAFE_FALLBACK_LISTING_DATE;
            console.warn(
              `[${processedCount}/${coins.length}] ${foundPair}: listingDate source unavailable, using safe fallback 2000-01-01`,
            );
          }
        }

        // Coin sudah pernah dicek, gunakan data yang ada
        const isValid =
          resolvedListingDate && resolvedListingDate < LISTING_CUTOFF_DATE;

        if (isValid) {
          console.log(
            `${foundPair}: Already checked, valid for analysis (${validCoins.length + 1}/${TARGET_VALID_COINS})`,
          );
          validCoins.push({
            ...coin,
            symbol: foundPair,
            listingDate: resolvedListingDate,
          });
        } else {
          console.log(
            `${foundPair}: Already checked, not valid for analysis (listed ${toDateLabel(resolvedListingDate)})`,
          );
        }

        const coinData = {
          ...coin,
          symbol: foundPair,
          listingDate: resolvedListingDate,
        };

        // Simpan/update langsung agar tidak fetch ulang saat rerun.
        await upsertCoinAndTopCoin(coinData);
        syncedSymbols.add(foundPair);
        savedCount++;
        console.log(
          `[${processedCount}/${coins.length}] ✅ Saved ${foundPair} (${savedCount} total saved)`,
        );

        // Setelah coin tersimpan, baru hentikan jika target valid 20 sudah terpenuhi.
        if (validCoins.length >= TARGET_VALID_COINS) {
          console.log(
            `✅ Target reached: ${validCoins.length}/${TARGET_VALID_COINS} valid coins. Stopping scan.`,
          );
          break coinLoop;
        }

        continue;
      }

      // Coin belum pernah dicek, fetch earliest candle (via client)
      console.log(
        `[${processedCount}/${coins.length}] ${foundPair}: Checking earliest candle...`,
      );
      const earliestCandle = await fetchEarliestCandle(foundPair);

      let listingDate = coin.cmcListingDate;
      if (earliestCandle) {
        listingDate = new Date(earliestCandle.time);
      } else if (listingDate) {
        console.log(
          `[${processedCount}/${coins.length}] ${foundPair}: fallback listingDate from CMC (${listingDate.toISOString().split("T")[0]})`,
        );
      } else {
        listingDate = SAFE_FALLBACK_LISTING_DATE;
        console.warn(
          `[${processedCount}/${coins.length}] ${foundPair}: listingDate source unavailable, using safe fallback 2000-01-01`,
        );
      }

      // Fetch logo dari CMC untuk coin ini (via client)
      let logo = null;
      try {
        const baseSymbol = foundPair.split("-")[0];
        const infoData = await getCoinLogos(baseSymbol);
        logo = infoData?.data?.[baseSymbol]?.[0]?.logo || null;
      } catch (logoErr) {
        console.warn(`⚠️  Failed to fetch logo for ${foundPair}`);
      }

      const coinData = {
        ...coin,
        symbol: foundPair,
        listingDate: listingDate,
        logo: logo, // ✅ Logo sudah ada
      };

      // Simpan/update langsung agar progress tidak hilang saat restart.
      await upsertCoinAndTopCoin(coinData);
      syncedSymbols.add(foundPair);
      savedCount++;
      console.log(
        `[${processedCount}/${coins.length}] ✅ Saved ${foundPair} (${savedCount} total saved)`,
      );

      // Cek apakah valid untuk analisis
      if (listingDate < LISTING_CUTOFF_DATE) {
        validCoins.push(coinData);
        console.log(
          `${foundPair}: Valid for analysis (${validCoins.length}/${TARGET_VALID_COINS})`,
        );

        if (validCoins.length >= TARGET_VALID_COINS) {
          console.log(
            `✅ Target reached: ${validCoins.length}/${TARGET_VALID_COINS} valid coins. Stopping scan.`,
          );
          break coinLoop;
        }
      } else {
        console.log(
          `${foundPair}: Too new for analysis (${listingDate.toISOString().split("T")[0]})`,
        );
      }
    }

    if (savedCount === 0) {
      throw new Error("Tidak ada coin yang bisa dipair dengan Coinbase");
    }

    // 6. DELETE semua TopCoin yang rank terlalu jauh agar tabel tetap bersih.
    // Simpan pool lebih panjang supaya fallback rank berikutnya bisa memenuhi 20 coin valid.
    const oldTopCoins = await prisma.topCoin.findMany({
      include: { coin: true },
    });

    const coinsToDelete = oldTopCoins.filter(
      (tc) => tc.coin.rank && tc.coin.rank > 100,
    );

    for (const tc of coinsToDelete) {
      await prisma.topCoin.delete({ where: { id: tc.id } });
      console.log(`Deleted: ${tc.coin.symbol} (rank ${tc.coin.rank})`);
    }

    // 7. Reconcile rank agar update rank terbaru selalu konsisten dan tidak duplikat.
    const syncedSymbolsList = Array.from(syncedSymbols);
    if (syncedSymbolsList.length > 0 && incomingRanks.size > 0) {
      await prisma.coin.updateMany({
        where: {
          symbol: { notIn: syncedSymbolsList },
          rank: { in: Array.from(incomingRanks) },
        },
        data: { rank: null },
      });
    }

    const duplicateRanks = await prisma.coin.groupBy({
      by: ["rank"],
      where: { rank: { not: null } },
      _count: { rank: true },
      having: { rank: { _count: { gt: 1 } } },
    });

    for (const dup of duplicateRanks) {
      const sameRankCoins = await prisma.coin.findMany({
        where: { rank: dup.rank },
        select: { id: true, symbol: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      const keep =
        sameRankCoins.find((c) => syncedSymbols.has(c.symbol)) ||
        sameRankCoins[0];
      const toNull = sameRankCoins
        .filter((c) => c.id !== keep.id)
        .map((c) => c.id);

      if (toNull.length > 0) {
        await prisma.coin.updateMany({
          where: { id: { in: toNull } },
          data: { rank: null },
        });
        console.log(
          `♻️ Rank ${dup.rank} deduplicated: keeping ${keep.symbol}, cleared ${toNull.length} duplicate(s)`,
        );
      }
    }

    console.log(`Sync completed: ${savedCount} coins saved`);
    console.log(`${validCoins.length} coins available for analysis\n`);

    return {
      success: true,
      message: `Sync berhasil: ${savedCount} coins saved, ${validCoins.length} valid for analysis`,
      total: savedCount,
      validCount: validCoins.length,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
