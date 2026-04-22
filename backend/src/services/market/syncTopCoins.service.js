import dotenv from "dotenv";
import { prisma } from "../../lib/prisma.js";
import { cleanTopCoinData } from "../../utils/dataCleaner.js";
import { fetchPairs } from "../../clients/coinbase.client.js";
import { findEarliestCoinbaseCandleTime } from "../coinbase/coinbase.service.js";
import {
  getTopCoins,
  getCoinLogos,
} from "../../clients/coinmarketcap.client.js";

dotenv.config();

// Buffer coin valid yang disimpan di tabel topCoin untuk seleksi lanjutan.
const TARGET_VALID_COINS = Number(
  process.env.TARGET_ASSET_BUFFER_LIMIT || "20",
);
const CMC_SCAN_LIMIT = Number(
  process.env.CMC_FETCH_LIMIT || process.env.TARGET_ASSET_BUFFER_LIMIT || "20",
);
const LISTING_CUTOFF_DATE = new Date("2025-01-01T00:00:00.000Z");
let isSyncTopCoinsRunning = false;
const STABLECOIN_SYMBOLS = new Set([
  "USDT",
  "USDC",
  "DAI",
  "BUSD",
  "TUSD",
  "USDP",
  "GUSD",
  "USDE",
  "FDUSD",
  "PYUSD",
  "USDD",
  "FRAX",
  "EURC",
]);

const stablecoinPrefixFilters = Array.from(STABLECOIN_SYMBOLS).map(
  (symbol) => ({ symbol: { startsWith: `${symbol}-` } }),
);
const coinbaseListingDateCache = new Map();

function getBaseSymbol(pairSymbol) {
  return String(pairSymbol || "")
    .split("-")[0]
    .toUpperCase();
}

function isEligibleListingDate(listingDate) {
  return Boolean(listingDate && listingDate < LISTING_CUTOFF_DATE);
}

// Ambil listing date berbasis candle pertama Coinbase agar tidak bias data CMC.
async function getCoinbaseListingDate(symbol) {
  if (coinbaseListingDateCache.has(symbol)) {
    return coinbaseListingDateCache.get(symbol);
  }

  const earliestTime = await findEarliestCoinbaseCandleTime(symbol);
  const listingDate = earliestTime ? new Date(earliestTime) : null;
  coinbaseListingDateCache.set(symbol, listingDate);
  return listingDate;
}

async function assignFallbackRanksToCoins(coinIds = []) {
  if (!coinIds.length) return 0;

  await prisma.coin.updateMany({
    where: { id: { in: coinIds } },
    data: { rank: null },
  });

  return coinIds.length;
}

async function ensureAllCoinRanksNotNull(cmcRankMap = new Map()) {
  const mappedCoins = await prisma.coin.findMany({
    where: { rank: { not: null } },
    select: { id: true, symbol: true },
    orderBy: { id: "asc" },
  });

  if (!mappedCoins.length) {
    return { fixedFromCmc: 0, fixedFallback: 0, totalFixed: 0 };
  }

  const unmappedCoins = mappedCoins.filter(
    (coin) => !cmcRankMap.has(getBaseSymbol(coin.symbol)),
  );
  const fixedFallback = await assignFallbackRanksToCoins(
    unmappedCoins.map((coin) => coin.id),
  );

  return {
    fixedFromCmc: 0,
    fixedFallback,
    totalFixed: fixedFallback,
  };
}

async function ensureTopCoinRanksNotNull() {
  const nullRankTopCoins = await prisma.topCoin.findMany({
    where: { coin: { rank: null } },
    include: {
      coin: {
        select: { id: true, symbol: true },
      },
    },
    orderBy: { coin: { id: "asc" } },
  });

  for (const item of nullRankTopCoins) {
    console.warn(
      `⚠️ Rank for ${item.coin.symbol} not present in CMC snapshot. Keeping rank as null.`,
    );
  }

  return nullRankTopCoins.length;
}

// Sinkronisasi rank coin murni dari CMC.
// Coin yang tidak ada pada snapshot CMC akan dibiarkan rank null (tanpa fallback lokal).
export async function syncTopCoinRanksFromCmc(limit = CMC_SCAN_LIMIT) {
  try {
    const data = await getTopCoins(limit);
    if (!data?.data?.length) {
      throw new Error("Data rank CMC kosong.");
    }

    const cmcRankMap = new Map();
    for (const item of data.data) {
      const symbol = String(item.symbol || "").toUpperCase();
      const rank = Number(item.cmc_rank || 0);
      if (!symbol || !rank) continue;
      cmcRankMap.set(symbol, rank);
    }

    const topCoins = await prisma.topCoin.findMany({
      include: {
        coin: {
          select: { id: true, symbol: true, rank: true },
        },
      },
    });

    const allCoins = await prisma.coin.findMany({
      select: { id: true, symbol: true, rank: true },
    });

    let updatedCount = 0;
    for (const item of topCoins) {
      const baseSymbol = getBaseSymbol(item.coin.symbol);
      const cmcRank = cmcRankMap.get(baseSymbol);

      if (cmcRank != null && item.coin.rank !== cmcRank) {
        await prisma.coin.update({
          where: { id: item.coin.id },
          data: { rank: cmcRank },
        });
        updatedCount += 1;
      }
    }

    // Pastikan semua coin lain yang punya pasangan base symbol di CMC ikut sinkron murni.
    for (const coin of allCoins) {
      const cmcRank = cmcRankMap.get(getBaseSymbol(coin.symbol));
      if (cmcRank != null && coin.rank !== cmcRank) {
        await prisma.coin.update({
          where: { id: coin.id },
          data: { rank: cmcRank },
        });
        updatedCount += 1;
      }
    }

    const fixedNullTopCoinCount = await ensureTopCoinRanksNotNull();
    const allCoinNullFix = await ensureAllCoinRanksNotNull(cmcRankMap);
    const fixedNullCount = fixedNullTopCoinCount + allCoinNullFix.totalFixed;

    return {
      success: true,
      message: `Rank sync selesai. Updated: ${updatedCount}, Null fixed: ${fixedNullCount}`,
      updatedCount,
      fixedNullCount,
      fixedNullTopCoinCount,
      fixedNullFromCmc: allCoinNullFix.fixedFromCmc,
      fixedNullFallback: allCoinNullFix.fixedFallback,
      totalTopCoin: topCoins.length,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Sinkronisasi top coin dari CMC, padankan pair Coinbase, lalu simpan ke database.
export async function syncTopCoins() {
  if (isSyncTopCoinsRunning) {
    return {
      success: true,
      skipped: true,
      message: "Sync top coin sedang berjalan, skip duplicate trigger",
      total: 0,
      validCount: 0,
    };
  }

  isSyncTopCoinsRunning = true;

  try {
    // Bersihkan dulu entri topCoin stablecoin agar tidak ikut alur selection aktif.
    await prisma.topCoin.deleteMany({
      where: {
        coin: {
          OR: stablecoinPrefixFilters,
        },
      },
    });

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

    // 1. Ambil daftar coin CMC berurutan dari rank tertinggi.
    console.log(
      `Fetching top ${CMC_SCAN_LIMIT} coins from CoinMarketCap to fill target ${TARGET_VALID_COINS}...`,
    );

    // Semua HTTP request berada di client
    const data = await getTopCoins(CMC_SCAN_LIMIT);

    if (!data?.data) throw new Error("Data dari CMC kosong.");

    const rawCoins = data.data
      .map((c) => ({
        rank: c.cmc_rank,
        name: c.name,
        symbol: c.symbol.toUpperCase(),
        price: c.quote.USD.price,
        marketCap: c.quote.USD.market_cap,
        volume24h: c.quote.USD.volume_24h,
        cmcListingDate: c.date_added ? new Date(c.date_added) : null,
      }))
      .filter((coin) => !STABLECOIN_SYMBOLS.has(coin.symbol));

    const coins = cleanTopCoinData(rawCoins);
    if (coins.length === 0)
      throw new Error("Tidak ada coin valid setelah data cleaning.");

    // 2. Ambil pair aktif dari Coinbase (via client)
    const activePairs = await fetchPairs();

    if (activePairs.size === 0) {
      throw new Error("Tidak ada pair aktif di Coinbase");
    }

    // 3. Pairing berurutan berdasarkan rank CMC sampai dapat 20 coin yang match pair Coinbase.
    let savedCount = 0;
    const selectedCoins = [];
    let processedCount = 0;

    coinLoop: for (const coin of coins) {
      processedCount++;

      // Stop ketika sudah terkumpul 20 coin yang match pair Coinbase.
      if (selectedCoins.length >= TARGET_VALID_COINS) break;

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

      // WAJIB: listing date memakai data historis awal Coinbase (bukan CMC).
      const coinbaseListingDate = await getCoinbaseListingDate(foundPair);

      if (!isEligibleListingDate(coinbaseListingDate)) {
        console.log(
          `[${processedCount}/${coins.length}] ⏭️  ${foundPair}: Coinbase listing not eligible (${coinbaseListingDate ? coinbaseListingDate.toISOString().split("T")[0] : "null"})`,
        );
        continue;
      }

      // Cek apakah coin sudah pernah dicek sebelumnya (ada di database)
      const existingCoin = await prisma.coin.findFirst({
        where: { symbol: foundPair },
        select: { listingDate: true, symbol: true },
      });

      if (existingCoin) {
        const coinData = {
          ...coin,
          symbol: foundPair,
          // Override nilai lama agar sumber kebenaran listingDate selalu Coinbase.
          listingDate: coinbaseListingDate,
        };

        // Simpan/update langsung agar coin + rank selalu ikut snapshot CMC terbaru.
        await upsertCoinAndTopCoin(coinData);
        selectedCoins.push(coinData);
        savedCount++;
        console.log(
          `[${processedCount}/${coins.length}] Saved ${foundPair} (${savedCount} total saved, selected ${selectedCoins.length}/${TARGET_VALID_COINS})`,
        );

        if (selectedCoins.length >= TARGET_VALID_COINS) {
          console.log(
            `Target reached: ${selectedCoins.length}/${TARGET_VALID_COINS} paired coins. Stopping scan.`,
          );
          break coinLoop;
        }

        continue;
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
        // Untuk coin baru, langsung isi dari Coinbase historical earliest candle.
        listingDate: coinbaseListingDate,
        logo: logo, // Logo sudah ada
      };

      // Simpan/update langsung agar progress tidak hilang saat restart.
      await upsertCoinAndTopCoin(coinData);
      savedCount++;
      console.log(
        `[${processedCount}/${coins.length}] Saved ${foundPair} (${savedCount} total saved)`,
      );

      selectedCoins.push(coinData);
      if (selectedCoins.length >= TARGET_VALID_COINS) {
        console.log(
          `Target reached: ${selectedCoins.length}/${TARGET_VALID_COINS} paired coins. Stopping scan.`,
        );
        break coinLoop;
      }
    }

    if (savedCount === 0) {
      throw new Error("Tidak ada coin yang bisa dipair dengan Coinbase");
    }

    if (selectedCoins.length < TARGET_VALID_COINS) {
      console.warn(
        `⚠️ Paired coins hanya ${selectedCoins.length}/${TARGET_VALID_COINS} dari ${coins.length} ranking CMC yang discan`,
      );
    }

    // Pastikan tabel TopCoin hanya berisi aset valid hasil seleksi terbaru.
    // Ini mencegah aset lama (yang kini tidak lolos kriteria) tetap terbaca sistem.
    const selectedSymbols = selectedCoins.map((item) => item.symbol);
    await prisma.topCoin.deleteMany({
      where: {
        coin: {
          symbol: { notIn: selectedSymbols },
        },
      },
    });

    return {
      success: true,
      message: `Sync berhasil: ${savedCount} coins saved, ${selectedCoins.length} paired coins selected`,
      total: savedCount,
      validCount: selectedCoins.length,
    };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    isSyncTopCoinsRunning = false;
  }
}
