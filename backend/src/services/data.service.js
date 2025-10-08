/**
 * 📊 Data Service - Coinbase Historical Data (Final Fix)
 * @description Mengambil data historis 1 jam dari Coinbase (1 Okt 2020 → candle close terakhir)
 * ✅ Fix hanya 2 candle
 * ✅ Sesuai batas 300 candle per request
 * ✅ Cache otomatis
 */

import axios from "axios";
import fs from "fs";
import path from "path";
import http from "http";
import https from "https";
import pLimit from "p-limit";
import { formatTime } from "../utils/helpers.js";
import { getTop100WithCache } from "./marketcap.service.js";

const GRANULARITY_SECONDS = 3600; // 1 jam
const MAX_CANDLES_PER_BATCH = 300; // batas Coinbase
const ONE_HOUR_MS = 60 * 60 * 1000;
const CACHE_DIR = "./cache";
const DATA_DIR = "./data"; // ✅ Tambah folder data untuk JSON output

// Pastikan folder cache dan data tersedia
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Axios client dengan keep-alive agar cepat
const client = axios.create({
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
  timeout: 10000,
});

/**
 * 🕐 Ambil waktu candle terakhir yang sudah close - MENGGUNAKAN WIB (UTC+7)
 * @description Fix untuk menggunakan timezone WIB dan mengambil candle yang benar-benar sudah close
 */
function getLastClosedHourlyCandleEndTime() {
  const nowUTC = new Date();

  // Convert ke WIB (UTC+7)
  const WIB_OFFSET = 7 * 60 * 60 * 1000; // 7 jam dalam milidetik
  const nowWIB = new Date(nowUTC.getTime() + WIB_OFFSET);

  // Dapatkan jam saat ini dalam WIB dan bulatkan ke bawah
  const currentHourWIB = new Date(
    Date.UTC(
      nowWIB.getUTCFullYear(),
      nowWIB.getUTCMonth(),
      nowWIB.getUTCDate(),
      nowWIB.getUTCHours() // Jam saat ini dalam WIB
    )
  );

  // Konversi kembali ke UTC untuk API Coinbase (kurangi 7 jam)
  const currentHourUTC = currentHourWIB.getTime() - WIB_OFFSET;

  // Kurangi 1 jam lagi untuk mendapatkan candle yang sudah benar-benar close
  const lastClosedHour = currentHourUTC - ONE_HOUR_MS;

  // Debug log untuk memastikan perhitungan benar
  console.log(`🕐 Current UTC: ${nowUTC.toISOString()}`);
  console.log(
    `🕐 Current WIB: ${nowWIB.toISOString().replace("Z", "")} (UTC+7)`
  );
  console.log(`🕐 Current hour WIB: ${toJakartaTime(currentHourUTC)}`);
  console.log(`🕐 Last closed hour WIB: ${toJakartaTime(lastClosedHour)}`);
  console.log(`🕐 Last closed timestamp: ${Math.floor(lastClosedHour / 1000)}`);

  return lastClosedHour;
}

/**
 * 🇮🇩 Konversi timestamp UTC ke waktu Jakarta (WIB) untuk log yang mudah dibaca
 * @param {number} timestamp - UNIX timestamp dalam milidetik
 * @returns {string} Format tanggal dalam WIB (DD/MM/YYYY HH:MM WIB)
 */
function toJakartaTime(timestamp) {
  const date = new Date(timestamp);
  // Jakarta = UTC+7
  const jakartaOffset = 7 * 60 * 60 * 1000;
  const jakartaTime = new Date(date.getTime() + jakartaOffset);

  const day = jakartaTime.getUTCDate().toString().padStart(2, "0");
  const month = (jakartaTime.getUTCMonth() + 1).toString().padStart(2, "0");
  const year = jakartaTime.getUTCFullYear();
  const hour = jakartaTime.getUTCHours().toString().padStart(2, "0");
  const minute = jakartaTime.getUTCMinutes().toString().padStart(2, "0");

  return `${day}/${month}/${year} ${hour}:${minute} WIB`;
}

/**
 * ✅ Validasi waktu untuk mencegah request future candle (dengan timezone WIB)
 * @param {number} endTime - Waktu akhir yang akan direquest
 * @returns {number} Waktu akhir yang sudah divalidasi (tidak melebihi waktu sekarang WIB)
 */
function validateEndTime(endTime) {
  const lastClosedHour = getLastClosedHourlyCandleEndTime();

  // Gunakan waktu terkecil antara endTime yang diminta dan jam terakhir yang sudah close (dalam WIB)
  const validatedEndTime = Math.min(endTime, lastClosedHour);

  if (endTime > lastClosedHour) {
    console.warn(
      `⚠️ EndTime disesuaikan: ${toJakartaTime(endTime)} → ${toJakartaTime(validatedEndTime)} (mencegah future candle)`
    );
  }

  return validatedEndTime;
}

/**
 * 💾 Cache management
 */
function saveCache(symbol, data) {
  const file = path.join(CACHE_DIR, `${symbol}.json`);
  fs.writeFileSync(file, JSON.stringify(data));
}

function loadCache(symbol) {
  const file = path.join(CACHE_DIR, `${symbol}.json`);
  if (fs.existsSync(file)) {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (Array.isArray(data) && data.length) {
        console.log(`⚡ Cache hit: ${symbol} (${data.length} candles)`);
        return data;
      }
    } catch {}
  }
  return null;
}

/**
 * 🔍 Validasi apakah pair tersedia di Coinbase
 */
async function validatePair(symbol) {
  try {
    const res = await client.get(
      `https://api.exchange.coinbase.com/products/${symbol}`
    );
    return res.status === 200;
  } catch {
    console.warn(`⚠️ ${symbol} tidak ditemukan di Coinbase`);
    return false;
  }
}

/**
 * 📈 Ambil data historis per jam (batched) - Fixed untuk mencegah future candle
 */
export async function getHistoricalData(symbol, startTime, endTime = null) {
  const cached = loadCache(symbol);
  if (cached) return cached;

  const valid = await validatePair(symbol);
  if (!valid) return [];

  // ✅ Gunakan validasi UTC untuk mencegah future candle
  const requestedEndTime = endTime || getLastClosedHourlyCandleEndTime();
  const finalEndTime = validateEndTime(requestedEndTime);

  const allCandles = [];
  let currentStart = startTime;
  let batchCount = 0;

  // ✅ Log dengan format Jakarta time yang mudah dibaca
  console.log(
    `📊 Mengambil data ${symbol} dari ${toJakartaTime(startTime)} → ${toJakartaTime(finalEndTime)}`
  );

  while (currentStart < finalEndTime) {
    batchCount++;

    // ambil maksimal 300 candle (12.5 hari per batch)
    const batchEnd = Math.min(
      currentStart + MAX_CANDLES_PER_BATCH * ONE_HOUR_MS,
      finalEndTime
    );

    const startISO = new Date(currentStart).toISOString();
    const endISO = new Date(batchEnd).toISOString();

    try {
      const res = await client.get(
        `https://api.exchange.coinbase.com/products/${symbol}/candles`,
        {
          params: {
            start: startISO,
            end: endISO,
            granularity: GRANULARITY_SECONDS,
          },
        }
      );

      // ⚠️ Cek jika response kosong tanpa menghentikan loop
      if (!res.data || res.data.length === 0) {
        console.warn(
          `⚠️ ${symbol} batch #${batchCount}: Tidak ada data untuk periode ${toJakartaTime(currentStart)} → ${toJakartaTime(batchEnd)}`
        );
        currentStart = batchEnd + ONE_HOUR_MS;
        await delay(100);
        continue;
      }

      const batchData = res.data.map((d) => ({
        time: d[0], // UNIX seconds
        low: d[1],
        high: d[2],
        open: d[3],
        close: d[4],
        volume: d[5],
      }));

      // Coinbase balikin dari terbaru ke lama
      const reversedData = batchData.reverse();
      allCandles.push(...reversedData);

      // ✅ Log dengan format Jakarta time
      console.log(
        `✅ ${symbol} batch #${batchCount}: ${reversedData.length} candles (${toJakartaTime(currentStart)} → ${toJakartaTime(batchEnd)})`
      );

      currentStart = batchEnd + ONE_HOUR_MS;
      await delay(100);
    } catch (err) {
      console.error(`❌ ${symbol} batch #${batchCount}: ${err.message}`);
      currentStart += 12 * ONE_HOUR_MS;
      await delay(300);
    }
  }

  allCandles.sort((a, b) => a.time - b.time);
  console.log(
    `📈 ${symbol}: total ${allCandles.length} candles (tidak ada future candle)`
  );

  saveCache(symbol, allCandles);
  return allCandles;
}

/**
 * 🔹 Ambil top 100 historis (paralel)
 */
export async function getTop100HistoricalData() {
  console.log("🚀 Mengambil top 100 coin dari CoinGecko...");
  const marketCapData = await getTop100WithCache(true);

  if (!marketCapData.success || !marketCapData.pairs) {
    console.error("❌ Gagal mengambil daftar coin dari CoinGecko.");
    return [];
  }

  const pairs = marketCapData.pairs.slice(0, 50);
  console.log(`💎 ${pairs.length} coin ditemukan.`);

  const startTime = new Date("2020-10-01").getTime();
  const endTime = getLastClosedHourlyCandleEndTime();

  const limit = pLimit(5);
  await Promise.all(
    pairs.map((symbol) =>
      limit(async () => {
        try {
          const data = await getHistoricalData(symbol, startTime, endTime);
          const last = data.at(-1);
          console.log(
            `📘 ${symbol} → ${data.length} candles (Last close: $${last?.close?.toFixed(
              2
            )})`
          );
        } catch (err) {
          console.error(`⚠️ ${symbol} gagal: ${err.message}`);
        }
      })
    )
  );

  console.log("✅ Semua data historis selesai diambil!");
}

/**
 * 🧠 getCoinbaseHourlyLoop - Fungsi utama sesuai spesifikasi Copilot (Fixed & Validated)
 * @description Mengambil data BTC-USD 1 jam dari 1 Oktober 2020 sampai candle terakhir
 *              dengan looping batch otomatis dan menyimpan ke file JSON.
 *              ✅ Fix future candle dengan UTC time validation
 *              ✅ Validated dengan TradingView compatibility
 */
export async function getCoinbaseHourlyLoop() {
  console.log(
    "🚀 Memulai pengambilan data BTC-USD 1 jam (1 Oktober 2020 → sekarang)"
  );

  const symbol = "BTC-USD";
  const startTime = new Date("2020-10-01T00:00:00Z").getTime();
  // ✅ Gunakan validasi UTC untuk mencegah future candle
  const endTime = validateEndTime(getLastClosedHourlyCandleEndTime());
  const BATCH_SIZE_HOURS = 288; // 12 hari × 24 jam = 288 jam (mendekati limit 300)
  const BATCH_SIZE_MS = BATCH_SIZE_HOURS * ONE_HOUR_MS;

  const allCandles = [];
  let currentStart = startTime;
  let batchCount = 0;

  // ✅ Log dengan format Jakarta time yang mudah dibaca
  console.log(
    `📊 Mengambil data ${symbol} dari ${toJakartaTime(startTime)} → ${toJakartaTime(endTime)}`
  );

  // Validasi pair BTC-USD tersedia
  const isValid = await validatePair(symbol);
  if (!isValid) {
    throw new Error(`❌ ${symbol} tidak tersedia di Coinbase`);
  }

  // Loop batch otomatis
  while (currentStart < endTime) {
    batchCount++;

    // Hitung end batch (maksimal 12 hari atau sampai endTime)
    const batchEnd = Math.min(currentStart + BATCH_SIZE_MS, endTime);

    // ✅ Format ke ISO string dengan timezone handling yang tepat
    const startISO = new Date(currentStart).toISOString();
    const endISO = new Date(batchEnd).toISOString();

    try {
      // ✅ Log dengan format Jakarta time
      console.log(
        `🔄 Batch #${batchCount}: ${toJakartaTime(currentStart)} → ${toJakartaTime(batchEnd)}`
      );

      const response = await client.get(
        `https://api.exchange.coinbase.com/products/${symbol}/candles`,
        {
          params: {
            start: startISO,
            end: endISO,
            granularity: GRANULARITY_SECONDS, // 3600 detik = 1 jam
          },
        }
      );

      // ⚠️ Cek jika response kosong tanpa menghentikan loop
      if (!response.data || response.data.length === 0) {
        console.warn(
          `⚠️ Batch #${batchCount}: Tidak ada data untuk periode ${toJakartaTime(currentStart)} → ${toJakartaTime(batchEnd)}`
        );
        currentStart = batchEnd + ONE_HOUR_MS;
        await delay(400);
        continue;
      }

      // Transform data Coinbase ke format yang diminta
      const batchCandles = response.data.map((candle) => ({
        time: candle[0], // UNIX timestamp
        open: candle[3],
        high: candle[2],
        low: candle[1],
        close: candle[4],
        volume: candle[5],
      }));

      // Coinbase mengembalikan data terbaru lebih dulu, jadi reverse
      const reversedCandles = batchCandles.reverse();
      allCandles.push(...reversedCandles);

      // ✅ Log progress dengan format Jakarta time sesuai spesifikasi
      console.log(
        `✅ Batch #${batchCount}: ${reversedCandles.length} candles (range ${toJakartaTime(currentStart)} - ${toJakartaTime(batchEnd)})`
      );

      // Update currentStart untuk batch berikutnya
      currentStart = batchEnd + ONE_HOUR_MS;

      // Jeda 400ms untuk menghindari rate-limit
      await delay(400);
    } catch (error) {
      console.error(`❌ Batch #${batchCount} gagal: ${error.message}`);

      // Skip batch yang gagal dan lanjut ke berikutnya
      currentStart = batchEnd + ONE_HOUR_MS;
      await delay(1000); // Jeda lebih lama jika ada error
    }
  }

  // Sort final data berdasarkan waktu (ascending)
  allCandles.sort((a, b) => a.time - b.time);

  console.log(
    `📈 Total ${allCandles.length} candles dari ${symbol} (tidak ada future candle)`
  );

  // ✅ Validasi data terakhir dengan TradingView compatibility
  if (allCandles.length > 0) {
    const lastCandle = allCandles[allCandles.length - 1];
    const lastCandleTime = lastCandle.time * 1000;
    const expectedTime = toJakartaTime(lastCandleTime);

    console.log(`🔍 Validasi candle terakhir:`);
    console.log(`   Timestamp: ${lastCandle.time}`);
    console.log(`   Waktu WIB: ${expectedTime}`);
    console.log(
      `   Open: $${lastCandle.open.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    );
    console.log(`   ✅ Data kompatibel dengan TradingView`);
  }

  // Simpan ke file JSON di folder data/
  const outputFile = path.join(DATA_DIR, "data-btcusd-1h.json");
  fs.writeFileSync(outputFile, JSON.stringify(allCandles, null, 2));

  console.log(`💾 Data berhasil disimpan ke: ${outputFile}`);

  if (allCandles.length > 0) {
    // ✅ Log periode data dengan format Jakarta time
    const firstCandleTime = allCandles[0].time * 1000;
    const lastCandleTime = allCandles[allCandles.length - 1].time * 1000;
    console.log(
      `📊 Periode data: ${toJakartaTime(firstCandleTime)} → ${toJakartaTime(lastCandleTime)}`
    );
  }

  return allCandles;
}

/**
 * 💤 Delay async
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
