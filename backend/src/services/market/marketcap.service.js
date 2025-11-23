// pairing & live marketcap summary
import dotenv from "dotenv";
import { prisma } from "../../lib/prisma.js";
import { syncTopCoins } from "./cmcTopCoins.service.js";
import { fetchPairs, fetchTicker } from "./coinbase.service.js";

dotenv.config();

const BASES = ["USD", "USDT", "EUR", "USDC"];

/**
 * 💰 Format harga dengan desimal dinamis untuk menangani aset dengan harga sangat kecil
 * (seperti SHIB, PEPE, dll) agar tidak dibulatkan menjadi 0
 *
 * - value >= 1      → 2 decimal places (e.g., 100.00)
 * - 0.01 <= value < 1 → 4 decimal places (e.g., 0.0123)
 * - value < 0.01    → 6 decimal places (e.g., 0.000123)
 */
function formatPrice(value) {
  if (value == null) return null;

  if (value >= 1) return Number(value.toFixed(2));
  if (value >= 0.01) return Number(value.toFixed(4));
  return Number(value.toFixed(6));
}

/**
 * 📊 Ambil Top 30 dari CMC → Pairing Top 20 dengan Coinbase → Simpan ke DB
 * ✅ Include logo dari tabel Coin
 */
export async function getMarketcapRealtime() {
  try {
    console.log("🚀 Starting CMC sync process...");

    // 🎯 syncTopCoins sudah handle: fetch 30, pair 20, save to TopCoin
    const cmc = await syncTopCoins();

    if (!cmc.success) {
      throw new Error(cmc.error || "Gagal mengambil data dari CMC.");
    }

    console.log(
      `✅ Sync completed: ${cmc.coinsPaired} coins paired with Coinbase`
    );

    // Ambil data yang sudah disimpan dari TopCoin table
    const topCoins = await prisma.topCoin.findMany({
      where: { rank: { lte: 30 } }, // Hanya ambil rank <= 30
      orderBy: { rank: "asc" },
      take: 20, // Ambil maksimal 20
    });

    // ✅ Ambil logo dari tabel Coin untuk setiap symbol
    const coinsWithLogo = await Promise.all(
      topCoins.map(async (coin) => {
        const coinData = await prisma.coin.findUnique({
          where: { symbol: coin.symbol },
          select: { logo: true },
        });

        return {
          rank: coin.rank,
          name: coin.name,
          symbol: coin.symbol,
          price: coin.price,
          marketCap: coin.marketCap,
          volume24h: coin.volume24h,
          logo: coinData?.logo || null, // ✅ Include logo
        };
      })
    );

    console.log(`✅ Returning ${coinsWithLogo.length} coins with logos`);

    return {
      success: true,
      total: coinsWithLogo.length,
      message: `Berhasil pairing ${coinsWithLogo.length} coin dengan rank dari CMC`,
      coins: coinsWithLogo, // ✅ Return coins with logo
    };
  } catch (e) {
    console.error("❌ Sync error:", e.message);
    return { success: false, message: e.message };
  }
}

/**
 * ⚡ Ambil harga live + candle terakhir untuk coin teratas + history + summary
 * 🎯 Return ONLY Top 20 paired coins (guaranteed count)
 * 🔗 Filter hanya symbol dengan format BASE-QUOTE (mengandung "-")
 */
export async function getMarketcapLive(limit = 20) {
  try {
    // 🎯 Enforce maximum limit of 20
    const requestedLimit = Math.max(1, Math.min(Number(limit) || 20, 20));

    // 🎯 Ambil kandidat 3× limit untuk antisipasi coin yang gagal fetch
    const candidateLimit = requestedLimit * 3;

    console.log(
      `⚡ Fetching ${candidateLimit} candidate coins (target: ${requestedLimit})...`
    );

    // Ambil kandidat coin berdasarkan rank dari TopCoin table
    // 🔗 Filter hanya symbol yang mengandung "-" (format BASE-QUOTE)
    const candidateCoins = await prisma.topCoin.findMany({
      where: {
        symbol: { contains: "-" }, // ✅ Hanya pair valid seperti BTC-USD, ETH-USD
      },
      orderBy: { rank: "asc" },
      take: candidateLimit, // Ambil 3× limit sebagai cadangan
    });

    if (!candidateCoins.length) {
      return {
        success: false,
        message: "⚠️ Belum ada coin pair di DB. Jalankan /api/marketcap dulu.",
      };
    }

    console.log(
      `📋 Got ${candidateCoins.length} candidates (valid pairs only), processing until ${requestedLimit} valid...`
    );

    // 🎯 Loop kandidat dan kumpulkan coin valid sampai mencapai limit
    const data = [];
    let successCount = 0;
    let failedCount = 0;

    for (const coin of candidateCoins) {
      // 🛑 Stop jika sudah mencapai limit yang diminta
      if (data.length >= requestedLimit) {
        console.log(
          `✅ Reached target of ${requestedLimit} coins, stopping...`
        );
        break;
      }

      // 🔍 Debug log sebelum fetch ticker
      console.log(`🔍 Fetching ticker for ${coin.symbol} rank ${coin.rank}`);

      // Fetch live data dari Coinbase
      const liveData = await fetchTicker(coin.symbol);

      // Skip jika data tidak lengkap
      if (
        !liveData ||
        liveData.price == null ||
        liveData.volume == null ||
        liveData.open == null
      ) {
        console.warn(
          `⚠️ Data tidak lengkap untuk ${coin.symbol} (price: ${liveData?.price}, volume: ${liveData?.volume}, open: ${liveData?.open}), skip...`
        );
        failedCount++;
        continue;
      }

      // Get last 10 candles for history chart (oldest to newest)
      const historyCandles = await prisma.candle.findMany({
        where: { symbol: coin.symbol },
        orderBy: { time: "desc" },
        take: 10,
      });

      // 💰 Gunakan raw values (tanpa pembulatan) untuk perhitungan akurat
      const rawPrice = Number(liveData.price);
      const rawVolume = Number(liveData.volume);
      const rawOpen = Number(liveData.open);
      const rawHigh = Number(liveData.high);
      const rawLow = Number(liveData.low);

      // 🧮 Hitung marketCap menggunakan nilai RAW, baru dibulatkan di akhir
      const rawMarketCap = rawVolume * rawPrice;

      // 🧮 Hitung change24h menggunakan nilai RAW untuk akurasi
      const change24h =
        rawOpen > 0
          ? Number((((rawPrice - rawOpen) / rawOpen) * 100).toFixed(2))
          : 0;

      const chartColor = rawPrice >= rawOpen ? "green" : "red";

      // 💰 Format history dengan desimal dinamis
      const history = historyCandles
        .reverse()
        .map((c) => formatPrice(Number(c.close)));

      // Tambahkan coin valid ke array
      data.push({
        rank: coin.rank,
        name: coin.name || coin.symbol.split("-")[0],
        symbol: coin.symbol,
        logo: null, // ✅ Will be filled from Coin table
        price: formatPrice(rawPrice), // 💰 Format dengan desimal dinamis
        volume: Number(rawVolume.toFixed(2)), // Volume tetap 2 desimal
        marketCap: Number(rawMarketCap.toFixed(2)), // 🧮 MarketCap dari nilai RAW
        open: formatPrice(rawOpen), // 💰 Format dengan desimal dinamis
        high: formatPrice(rawHigh), // 💰 Format dengan desimal dinamis
        low: formatPrice(rawLow), // 💰 Format dengan desimal dinamis
        change24h,
        chartColor,
        history,
      });

      successCount++;
      console.log(`✓ ${coin.symbol} added (${data.length}/${requestedLimit})`);
    }

    // Validasi: pastikan ada data valid
    if (data.length === 0) {
      return {
        success: false,
        message: "Tidak ada data valid dari Coinbase",
      };
    }

    // ✅ Ambil logo dari tabel Coin untuk setiap symbol
    const dataWithLogo = await Promise.all(
      data.map(async (item) => {
        const coinData = await prisma.coin.findUnique({
          where: { symbol: item.symbol },
          select: { logo: true },
        });

        return {
          ...item,
          logo: coinData?.logo || null, // ✅ Tambahkan logo dari Coin table
        };
      })
    );

    // 🎯 Calculate summary metrics dari coin yang berhasil
    const totalMarketCap = dataWithLogo.reduce(
      (sum, coin) => sum + coin.marketCap,
      0
    );
    const totalVolume24h = dataWithLogo.reduce(
      (sum, coin) => sum + coin.volume,
      0
    );

    const btcCoin = dataWithLogo.find(
      (coin) => coin.symbol.startsWith("BTC-") || coin.symbol === "BTC"
    );
    const btcDominance =
      btcCoin && totalMarketCap > 0
        ? Number(((btcCoin.marketCap / totalMarketCap) * 100).toFixed(2))
        : 0;

    const activeCoins = dataWithLogo.length;
    const gainers = dataWithLogo.filter((coin) => coin.change24h > 0).length;
    const losers = dataWithLogo.filter((coin) => coin.change24h < 0).length;

    console.log(
      `✅ Successfully fetched ${successCount} coins (${failedCount} failed)`
    );
    console.log(
      `📊 Returning ${dataWithLogo.length} coins (requested: ${requestedLimit})`
    );

    return {
      success: true,
      requestedLimit, // 🎯 Limit yang diminta
      total: dataWithLogo.length, // 🎯 Jumlah coin yang berhasil dikembalikan
      count: dataWithLogo.length, // 🎯 Alias untuk total
      summary: {
        totalMarketCap: Number(totalMarketCap.toFixed(2)),
        totalVolume24h: Number(totalVolume24h.toFixed(2)),
        btcDominance,
        activeCoins,
        gainers,
        losers,
      },
      data: dataWithLogo, // ✅ Array coin valid dengan logo
    };
  } catch (e) {
    console.error("❌ Live error:", e.message);
    return { success: false, message: e.message };
  }
}
