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
const TARGET_VALID = Number(process.env.TARGET_VALID_COINS || 7);
const CUTOFF_DATE = new Date("2025-01-01");
const DEFAULT_TOP_PAIRS = [
  "BTC-USD",
  "ETH-USD",
  "XRP-USD",
  "SOL-USD",
  "DOGE-USD",
  "ADA-USD",
  "BCH-USD",
];

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
  // Cek apakah data sudah ada di cache
  if (listingDateCache.has(symbol)) {
    // Jika sudah ada → langsung kembalikan
    return listingDateCache.get(symbol);
  }

  // Jika belum ada → ambil dari API (cari candle paling awal)
  const earliest = await findEarliestCoinbaseCandleTime(symbol);
  // Jika ada → ubah ke object Date, jika tidak → null
  const date = earliest ? new Date(earliest) : null;

  // Simpan hasil ke cache
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
    console.log("Start sync top coins...");

    // 1. Ambil top 20 dari CMC
    // const data = await getTopCoins(TARGET_BUFFER);
    // if (!data?.data) throw new Error("Data CMC kosong");
    //
    // DATA AWAL CMC: hasil pertama dari endpoint listings/latest.
    // console.log("[DATA AWAL CMC] sample:", data.data[0]);

    // 2. Ambil pair Coinbase
    const activePairs = await fetchPairs();
    if (!activePairs.size) throw new Error("Pair Coinbase kosong");
    // console.log({ activePairs });

    // DATA AWAL COINBASE: daftar pair aktif pertama kali.
    // console.log("[DATA AWAL COINBASE] total:", activePairs.size);
    // console.log(
    //   "[DATA AWAL COINBASE] sample:",
    //   Array.from(activePairs).slice(0, 5),
    // );

    const results = [];

    // loop satu persatu
    // for (const coin of data.data) {
    //   if (results.length >= TARGET_VALID) break;
    //
    //   const symbol = coin.symbol.toUpperCase();
    //
    //   // skip stablecoin
    //   if (STABLECOINS.has(symbol)) {
    //     // console.log(`${symbol} stablecoin`);
    //     continue;
    //   }
    //
    //   // 3. pairing
    //   const possiblePairs = [
    //     `${symbol}-USD`,
    //     `${symbol}-USDT`,
    //     `${symbol}-USDC`,
    //   ];
    //
    //   const pair = possiblePairs.find((p) => activePairs.has(p));
    //   if (!pair) {
    //     console.log(`${symbol} tidak ada pair`);
    //     continue;
    //   }

    // loop fixed pairs (default)
    for (const pair of DEFAULT_TOP_PAIRS) {
      if (results.length >= TARGET_VALID) break;

      if (!activePairs.has(pair)) {
        console.log(`${pair} tidak ada pair`);
        continue;
      }

      const symbol = pair.split("-")[0];

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
        // console.log({ info });

        logo = info?.data?.[base]?.[0]?.logo;
        // console.log({ logo });
      } catch {
        console.warn(`gagal ambil logo ${symbol}`);
      }

      const coinData = {
        symbol: pair,
        name: symbol,
        rank: results.length + 1,
        price: 0,
        marketCap: 0,
        volume24h: 0,
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
    // loop satu persatu
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
        // Jika coin.logo ada (tidak null/undefined/false), maka: { logo: coin.logo }
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
