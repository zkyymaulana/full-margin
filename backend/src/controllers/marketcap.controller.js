import {
  getMarketcapRealtime,
  getMarketcapLive,
} from "../services/market/marketcap.service.js";
import {
  syncTopCoins,
  syncTopCoinRanksFromCmc,
} from "../services/market/index.js";
import { prisma } from "../lib/prisma.js";

const TARGET_TOP_SYMBOLS = 20;
const LISTING_CUTOFF_DATE = new Date("2025-01-01T00:00:00.000Z");
const SYMBOLS_SYNC_COOLDOWN_MS = Number(
  process.env.SYMBOLS_SYNC_COOLDOWN_MS || 5 * 60 * 1000,
);

let lastSymbolsSyncAt = 0;

async function ensureSymbolsFresh() {
  const shouldAutoSync =
    (process.env.ENABLE_SYMBOLS_AUTO_SYNC ?? "true").toLowerCase() === "true";

  if (!shouldAutoSync) return;

  const now = Date.now();
  const isCooldownActive = now - lastSymbolsSyncAt < SYMBOLS_SYNC_COOLDOWN_MS;

  if (isCooldownActive) return;

  const topCoinSync = await syncTopCoins();
  if (!topCoinSync?.success) {
    throw new Error(topCoinSync?.error || "Sync top coins gagal");
  }

  const rankSync = await syncTopCoinRanksFromCmc();
  if (!rankSync?.success) {
    throw new Error(rankSync?.error || "Sync rank CMC gagal");
  }

  lastSymbolsSyncAt = Date.now();
}

async function fetchRankedCoinCandidates(limit) {
  return prisma.topCoin.findMany({
    where: {
      coin: {
        // Pastikan format pair valid seperti BTC-USD.
        symbol: { contains: "-" },
      },
    },
    include: {
      coin: {
        select: {
          symbol: true,
          name: true,
          rank: true,
          logo: true,
          listingDate: true,
        },
      },
    },
    orderBy: [{ coin: { rank: "asc" } }, { coin: { symbol: "asc" } }],
    take: limit,
  });
}

function selectTopValidCandidates(candidates, cutoffDate, targetCount) {
  const selected = [];

  for (const candidate of candidates) {
    const listingDate = candidate.coin?.listingDate;
    const isValidListing = listingDate && listingDate < cutoffDate;
    if (!isValidListing) continue;

    selected.push(candidate);
    if (selected.length >= targetCount) break;
  }

  return selected;
}

// Sinkronisasi top coin dari CoinMarketCap lalu simpan hasil ke database.
export async function getCoinMarketcap(req, res) {
  try {
    // Proses sinkronisasi penuh dilakukan di service.
    const result = await getMarketcapRealtime();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.message || "Gagal sinkronisasi data marketcap.",
      });
    }

    res.json({
      success: true,
      message: result.message,
      total: result.total,
      coins: result.coins,
    });
  } catch (err) {
    console.error("Marketcap sync error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

// Ambil data market cap dan candle live untuk top coin.
export async function getMarketcapLiveController(req, res) {
  try {
    // Ambil data live market dari service agar controller tetap tipis.
    const result = await getMarketcapLive();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.message || "Gagal mengambil data live ticker.",
      });
    }

    res.json({
      success: true,
      message: "Berhasil mengambil data market cap dengan history.",
      timestamp: new Date().toISOString(),
      summary: result.summary,
      total: result.total,
      data: result.data,
    });
  } catch (err) {
    console.error("Live ticker error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

// Ambil simbol top coin dari database dengan filter listing date yang valid.
export async function getCoinSymbols(req, res) {
  try {
    await ensureSymbolsFresh();

    // Ambil kandidat berdasarkan rank, lalu lakukan filtering di memory.
    // Jika coin invalid (null / > cutoff), lanjut ke rank berikutnya.
    let rankedCandidates = await fetchRankedCoinCandidates(100);
    let topCoins = selectTopValidCandidates(
      rankedCandidates,
      LISTING_CUTOFF_DATE,
      TARGET_TOP_SYMBOLS,
    );

    // Jika hasil masih kurang 20, lakukan top-up sinkronisasi lalu ulangi seleksi.
    if (topCoins.length < TARGET_TOP_SYMBOLS) {
      console.warn(
        `Valid symbols only ${topCoins.length}/${TARGET_TOP_SYMBOLS}. Running top-up sync...`,
      );

      await syncTopCoins();

      rankedCandidates = await fetchRankedCoinCandidates(150);
      topCoins = selectTopValidCandidates(
        rankedCandidates,
        LISTING_CUTOFF_DATE,
        TARGET_TOP_SYMBOLS,
      );
    }

    // Urutkan hasil berdasarkan ranking coin.
    const sortedCoins = topCoins.sort((a, b) => {
      const rankA = Number.isFinite(a.coin.rank) ? a.coin.rank : 999;
      const rankB = Number.isFinite(b.coin.rank) ? b.coin.rank : 999;

      if (rankA !== rankB) return rankA - rankB;
      return String(a.coin.symbol || "").localeCompare(
        String(b.coin.symbol || ""),
      );
    });

    // Bentuk payload sederhana untuk response API.
    const symbols = sortedCoins.map((topCoin) => ({
      symbol: topCoin.coin.symbol,
      name: topCoin.coin.name,
      rank: topCoin.coin.rank,
      logo: topCoin.coin.logo,
      listingDate: topCoin.coin.listingDate,
    }));

    // Logging ringkas untuk membantu monitoring hasil query.
    console.log(
      `Found ${symbols.length} symbols in database (listed before Jan 1, 2025)`,
    );

    res.json({
      success: true,
      message: "Berhasil mengambil daftar symbol coin.",
      total: symbols.length,
      symbols: symbols,
    });
  } catch (err) {
    console.error("Get coin symbols error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}
