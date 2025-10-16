import { prisma } from "../../lib/prisma.js";
import { fetchHistoricalCandles } from "../coinbase/coinbase.service.js";
import {
  getLastCandleTime,
  saveCandlesToDB,
} from "../charts/chartdata.service.js";
import { calculateAndSaveIndicators } from "../indicators/indicator.service.js"; // ✅ Import indicator service

/* =========================
   🕒 TIME UTILITIES (dalam DETIK)
========================= */
const HOUR_SEC = 3600; // 1 jam = 3600 detik
const HOUR_MS = HOUR_SEC * 1000; // untuk Date operations
const INTERVAL_MS = Number(process.env.LIVE_INTERVAL_MS) || 30000;
const START_EPOCH_MS = Number(process.env.START_EPOCH_MS) || 1704067200000; // 1 Jan 2024

function getLastClosedHourlyCandleEndTime() {
  const now = Date.now();
  const lastHour = Math.floor(now / HOUR_MS) * HOUR_MS;
  return lastHour - HOUR_MS; // candle sebelumnya yang sudah close
}

function convertMsToSec(ms) {
  return Math.floor(ms / 1000); // ✅ Convert milidetik ke detik
}

/* =========================
   ⚙️ ENV & KONST
========================= */
const COIN_LIMIT = Number(process.env.COIN_LIMIT) || 100;

// ⬇️ jeda antar coin saat historical (agar super-aman dari 429)
const HISTORICAL_COIN_DELAY_MS =
  Number(process.env.HISTORICAL_COIN_DELAY_MS) || 2000;

const schedulers = new Map();

/* =========================
  BACKFILL 1 COIN (serial)
  - Ambil historical sampai lastClosed
  - Simpan ke DB
  - Hitung indicator
========================= */
async function backfillCoin(coinId, symbol) {
  const lastSaved = await getLastCandleTime(symbol);
  const lastClosed = getLastClosedHourlyCandleEndTime();

  const start = lastSaved ? Number(lastSaved) + HOUR_MS : START_EPOCH_MS;
  if (start >= lastClosed) {
    console.log(`⏭️ ${symbol}: sudah up-to-date (historical)`);
    return;
  }

  console.log(
    `📦 Historical ${symbol}: ${new Date(start).toISOString()} → ${new Date(
      lastClosed
    ).toISOString()}`
  );

  const candles = await fetchHistoricalCandles(symbol, start, lastClosed);
  if (!candles.length) {
    console.log(`⚠️ ${symbol}: tidak ada candle historical baru`);
    return;
  }

  await saveCandlesToDB(symbol, coinId, candles);
  console.log(`✅ ${symbol}: ${candles.length} candle historical disimpan`);

  // ✅ PERBAIKAN: Hitung indicator setelah candle disimpan
  try {
    await calculateAndSaveIndicators(symbol, "1h", "incremental");
    console.log(`📊 ${symbol}: indicator historical berhasil dihitung`);
  } catch (err) {
    console.error(
      `❌ ${symbol}: gagal hitung indicator historical -`,
      err.message
    );
  }
}

/* =========================
   🔄 LIVE SCHEDULER PER COIN
   - Cek tiap INTERVAL_MS
   - Simpan hanya candle yang sudah close
   - Hitung indicator untuk candle baru
========================= */
export async function startLiveUpdater(coinId, symbol) {
  if (schedulers.has(symbol)) return; // sudah aktif

  const update = async () => {
    try {
      const lastSaved = await getLastCandleTime(symbol);
      const lastClosed = getLastClosedHourlyCandleEndTime();
      if (lastSaved && lastSaved >= lastClosed) return; // sudah up-to-date

      const start = lastSaved ? Number(lastSaved) + HOUR_MS : START_EPOCH_MS;
      const candles = await fetchHistoricalCandles(symbol, start, lastClosed);

      if (candles.length) {
        await saveCandlesToDB(symbol, coinId, candles);
        console.log(
          `✅ ${symbol}: ${candles.length} candle LIVE disimpan (≤ ${new Date(
            lastClosed
          ).toISOString()})`
        );

        // ✅ PERBAIKAN: Hitung indicator untuk candle baru
        try {
          await calculateAndSaveIndicators(symbol, "1h", "incremental");
          console.log(`📊 ${symbol}: indicator LIVE berhasil dihitung`);
        } catch (indicatorErr) {
          console.error(
            `❌ ${symbol}: gagal hitung indicator live -`,
            indicatorErr.message
          );
        }
      }
    } catch (err) {
      if (err?.response?.status === 429) {
        console.warn(`⚠️ ${symbol}: rate limit (429), retry setelah 5s...`);
        await new Promise((r) => setTimeout(r, 5000));
      } else {
        console.error(`❌ ${symbol} live update error:`, err?.message || err);
      }
    }
  };

  // pertama kali jalan (cek cepat), lalu interval rutin
  console.log(
    `🕒 Live scheduler mulai: ${symbol} (interval ${INTERVAL_MS / 1000}s)`
  );
  await update();
  const id = setInterval(update, INTERVAL_MS);
  schedulers.set(symbol, id);
}

/* =========================
   🚀 START ALL (SERIAL HISTORICAL → LIVE)
   - PROSES 1 COIN DULU sampai selesai
   - jeda antar coin
   - lalu aktifkan live updater
========================= */
export async function startAllSchedulers() {
  await prisma.$connect();
  const coins = await prisma.coin.findMany({
    select: { id: true, symbol: true },
    take: COIN_LIMIT,
  });

  if (!coins.length) {
    console.warn("⚠️ Tidak ada coin di database.");
    return;
  }

  console.log(
    `⏳ Mulai historical sync SEKUENSIAL untuk ${coins.length} coin...`
  );

  for (const { id, symbol } of coins) {
    try {
      await backfillCoin(id, symbol); // ⬅️ SATU PERSATU
    } catch (e) {
      console.error(`❌ Historical ${symbol} gagal:`, e?.message || e);
    }
    // jeda aman antar coin historical
    if (HISTORICAL_COIN_DELAY_MS > 0)
      await new Promise((r) => setTimeout(r, HISTORICAL_COIN_DELAY_MS));
  }

  console.log(
    "✅ Historical selesai untuk semua coin. Mengaktifkan LIVE scheduler..."
  );

  // setelah historical rampung semuanya → aktifkan live (boleh paralel karena ringan)
  for (const { id, symbol } of coins) {
    // tidak di-await supaya langsung aktif semua live checker
    startLiveUpdater(id, symbol);
    // opsional: beri sedikit jeda mikro agar tidak start persis di ms yang sama
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log(`🎯 Semua live scheduler aktif untuk ${coins.length} coin`);
}

/* =========================
   🛑 STOP ALL
========================= */
export function stopAllSchedulers() {
  for (const [symbol, id] of schedulers.entries()) clearInterval(id);
  schedulers.clear();
  console.log("🛑 Semua scheduler dihentikan");
}
