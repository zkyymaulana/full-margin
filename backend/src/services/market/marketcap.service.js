import axios from "axios";
import dotenv from "dotenv";
import { prisma } from "../../lib/prisma.js";
import { syncTopCoins } from "./cmc.service.js";

dotenv.config();

const API = process.env.COINBASE_API_URL || "https://api.exchange.coinbase.com";
const TIMEOUT = 10000;
const BASES = ["USD", "USDT", "EUR", "USDC"];

/** 🔹 Ambil semua pair aktif dari Coinbase */
async function fetchPairs() {
  try {
    const { data } = await axios.get(`${API}/products`, { timeout: TIMEOUT });
    return new Set(
      data
        .filter((p) => p.status === "online" && !p.trading_disabled)
        .map((p) => p.id.toUpperCase())
    );
  } catch {
    console.error("❌ Gagal mengambil pair Coinbase");
    return new Set();
  }
}

/** 🔹 Ambil data harga & OHLC dari Coinbase */
async function fetchTicker(symbol) {
  try {
    const [ticker, stats] = await Promise.all([
      axios.get(`${API}/products/${symbol}/ticker`, { timeout: TIMEOUT }),
      axios.get(`${API}/products/${symbol}/stats`, { timeout: TIMEOUT }),
    ]);

    return {
      symbol,
      price: +ticker.data.price || 0,
      volume: +(ticker.data.volume || stats.data.volume || 0),
      high: +stats.data.high || 0,
      low: +stats.data.low || 0,
      open: +stats.data.open || 0,
      time: new Date(ticker.data.time || new Date()).getTime(),
    };
  } catch {
    return null;
  }
}

/**
 * 📊 Ambil top 200 dari CMC → Pairing dengan Coinbase → Simpan top 100 ke DB
 */
export async function getMarketcapRealtime() {
  try {
    console.log("🚀 Syncing Top 200 dari CoinMarketCap...");
    const cmc = await syncTopCoins(200);
    if (!cmc.success) throw new Error("Gagal mengambil data dari CMC.");

    const pairs = await fetchPairs();
    if (pairs.size === 0) throw new Error("Tidak ada pair aktif di Coinbase.");

    const top = await prisma.topCoin.findMany({
      orderBy: { rank: "asc" },
      take: 200,
    });

    const matched = [];
    for (const coin of top) {
      if (matched.length >= 20) break;
      const pair = BASES.map((b) => `${coin.symbol}-${b}`).find((p) =>
        pairs.has(p)
      );
      if (!pair) continue;

      // ✅ PERBAIKAN: Sertakan rank saat upsert
      await prisma.coin.upsert({
        where: { symbol: pair },
        update: {
          name: coin.name,
          rank: coin.rank, // ✅ Update rank juga
        },
        create: {
          symbol: pair,
          name: coin.name,
          rank: coin.rank, // ✅ Buat dengan rank
        },
      });

      console.log(`✅ ${pair}: rank ${coin.rank} - ${coin.name}`);

      matched.push({
        rank: coin.rank,
        name: coin.name,
        symbol: pair,
        price: +coin.price.toFixed(4),
        marketCap: Math.round(coin.marketCap),
      });
    }

    console.log(
      `✅ Pairing selesai (${matched.length} coin cocok dengan rank).`
    );
    return {
      success: true,
      total: matched.length,
      message: `Berhasil pairing ${matched.length} coin dengan rank dari CMC`,
      coins: matched,
    };
  } catch (e) {
    console.error("❌ Sync error:", e.message);
    return { success: false, message: e.message };
  }
}

/**
 * ⚡ Ambil harga live + candle terakhir untuk coin teratas
 */
export async function getMarketcapLive(limit = 20) {
  try {
    const take = Math.max(1, Math.min(Number(limit) || 20, 100));

    // ✅ Ambil hanya coin teratas berdasarkan rank
    const coins = await prisma.coin.findMany({
      where: { rank: { not: null } },
      orderBy: { rank: "asc" },
      take,
    });

    if (!coins.length)
      return {
        success: false,
        message: "⚠️ Belum ada coin di DB. Jalankan /api/marketcap dulu.",
      };

    const results = [];
    for (const c of coins) {
      const t = await fetchTicker(c.symbol);
      if (t)
        results.push({
          rank: c.rank,
          name: c.name,
          symbol: t.symbol,
          price: t.price,
          volume: t.volume,
          high: t.high,
          low: t.low,
          open: t.open,
          time: t.time,
        });
    }

    // ✅ Urutkan hasil berdasarkan rank (terkecil = teratas) dan batasi sesuai limit
    results.sort((a, b) => (a.rank || 999999) - (b.rank || 999999));
    const limited = results.slice(0, take);

    console.log(
      `✅ ${limited.length} data live berhasil diambil (top ${take} berdasarkan rank).`
    );
    return { success: true, total: limited.length, data: limited };
  } catch (e) {
    console.error("❌ Live error:", e.message);
    return { success: false, message: e.message };
  }
}

/**
 * 🔍 Debug function untuk cek rank coin yang tersimpan
 */
export async function debugCoinRanks() {
  try {
    const coins = await prisma.coin.findMany({
      select: { symbol: true, name: true, rank: true },
      orderBy: { rank: "asc" },
      // ✅ Hapus take untuk tampilkan semua
    });

    console.log("\n📋 All Coins dengan Rank:");
    coins.forEach((coin) => {
      console.log(
        `${coin.rank || "NULL"}: ${coin.symbol} - ${coin.name || "Unknown"}`
      );
    });

    const withoutRank = await prisma.coin.count({
      where: { rank: null },
    });

    console.log(`\n⚠️ Coin tanpa rank: ${withoutRank}`);

    return {
      success: true,
      coinsWithRank: coins.filter((c) => c.rank !== null).length,
      coinsWithoutRank: withoutRank,
      total: coins.length,
      data: coins,
    };
  } catch (e) {
    console.error("❌ Debug error:", e.message);
    return { success: false, message: e.message };
  }
}

/**
 * ⚡ Ambil detail live 1 coin (untuk chart)
 */
export async function getCoinLiveDetail(symbol) {
  try {
    const t = await fetchTicker(symbol);
    if (t) return { success: true, data: t };

    const coin = await prisma.coin.findUnique({
      where: { symbol },
      include: { candles: { orderBy: { time: "desc" }, take: 1 } },
    });

    if (!coin?.candles?.[0])
      return { success: false, message: `Data ${symbol} tidak ditemukan` };

    return {
      success: true,
      data: {
        symbol,
        price: coin.candles[0].close,
        volume: coin.candles[0].volume,
        time: Number(coin.candles[0].time), // ✅ PERBAIKAN: Convert ke detik untuk konsistensi
      },
    };
  } catch (e) {
    console.error(`❌ getCoinLiveDetail error: ${e.message}`);
    return { success: false, message: e.message };
  }
}
