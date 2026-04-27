import dotenv from "dotenv";
import { prisma } from "../../lib/prisma.js";
import { fetchPairs } from "../../clients/coinbase.client.js";
import { findEarliestCoinbaseCandleTime } from "../coinbase/coinbase.service.js";
import {
  getTopCoins,
  getCoinLogos,
} from "../../clients/coinmarketcap.client.js";

dotenv.config();

const TARGET_BUFFER = Number(process.env.TARGET_ASSET_BUFFER_LIMIT || 20);
const TARGET_VALID = Number(process.env.TARGET_VALID_COINS || 10);
const CUTOFF_DATE = new Date("2025-01-01");

let isSyncTopCoinsRunning = false;

// stablecoin filter
const STABLECOINS = new Set([
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

// cache biar hemat API
const listingDateCache = new Map();

async function getListingDate(symbol) {
  if (listingDateCache.has(symbol)) {
    return listingDateCache.get(symbol);
  }

  const earliest = await findEarliestCoinbaseCandleTime(symbol);
  const date = earliest ? new Date(earliest) : null;

  listingDateCache.set(symbol, date);
  return date;
}

export async function syncTopCoins() {
  if (isSyncTopCoinsRunning) {
    console.log("Skip: sync masih berjalan");
    return { skipped: true };
  }

  isSyncTopCoinsRunning = true;

  try {
    console.log("🚀 Start sync top coins...");

    // 1. Ambil top 20 dari CMC
    const data = await getTopCoins(TARGET_BUFFER);
    if (!data?.data) throw new Error("Data CMC kosong");

    // 2. Ambil pair Coinbase
    const activePairs = await fetchPairs();
    if (!activePairs.size) throw new Error("Pair Coinbase kosong");

    const results = [];

    for (const coin of data.data) {
      if (results.length >= TARGET_VALID) break;

      const symbol = coin.symbol.toUpperCase();

      // skip stablecoin
      if (STABLECOINS.has(symbol)) {
        console.log(`${symbol} stablecoin`);
        continue;
      }

      // 3. pairing
      const possiblePairs = [
        `${symbol}-USD`,
        `${symbol}-USDT`,
        `${symbol}-USDC`,
      ];

      const pair = possiblePairs.find((p) => activePairs.has(p));
      if (!pair) {
        console.log(`${symbol} tidak ada pair`);
        continue;
      }

      // 4. cek listing date
      const listingDate = await getListingDate(pair);
      if (!listingDate || listingDate >= CUTOFF_DATE) {
        console.log(`${pair} tidak lolos listing date`);
        continue;
      }

      // 5. ambil logo
      let logo;
      try {
        const base = symbol;
        const info = await getCoinLogos(base);
        logo = info?.data?.[base]?.[0]?.logo;
      } catch {
        console.warn(`gagal ambil logo ${symbol}`);
      }

      const coinData = {
        symbol: pair,
        name: coin.name,
        rank: coin.cmc_rank,
        price: coin?.quote?.USD?.price || 0,
        marketCap: coin?.quote?.USD?.market_cap || 0,
        volume24h: coin?.quote?.USD?.volume_24h || 0,
        listingDate,
        logo,
      };

      results.push(coinData);
      console.log(`${pair} paired (${results.length}/${TARGET_VALID})`);
    }

    if (results.length === 0) {
      throw new Error("Tidak ada coin valid");
    }

    // Update database dengan hasil sinkronisasi
    for (const coin of results) {
      const updateData = {
        rank: coin.rank,
        name: coin.name,
        listingDate: coin.listingDate,
      };

      // jangan override logo kalau undefined
      if (coin.logo !== undefined) {
        updateData.logo = coin.logo;
      }

      const createData = {
        symbol: coin.symbol,
        rank: coin.rank,
        name: coin.name,
        listingDate: coin.listingDate,
        ...(coin.logo && { logo: coin.logo }),
      };

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
    }

    // CLEANUP DATA LAMA
    const selectedSymbols = results.map((c) => c.symbol);

    await prisma.topCoin.deleteMany({
      where: {
        coin: {
          symbol: { notIn: selectedSymbols },
        },
      },
    });

    return {
      success: true,
      valid: results.length,
      coins: results,
    };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    isSyncTopCoinsRunning = false;
  }
}
