// src/utils/time.js
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * 🕐 Format timestamp ke format waktu tertentu
 * @param {number|string|Date} timestamp - Timestamp atau Date
 * @param {string} format - Format waktu (default: "DD/MM/YYYY HH:mm:ss")
 * @param {string} tz - Timezone (default: "Asia/Jakarta")
 * @returns {string} waktu yang diformat
 */
export function formatTime(
  timestamp,
  format = "DD/MM/YYYY HH:mm:ss",
  tz = "Asia/Jakarta"
) {
  try {
    if (!timestamp) return "-";
    return dayjs(timestamp).tz(tz).format(format);
  } catch (err) {
    console.error("❌ Error formatTime:", err.message);
    return "-";
  }
}

/**
 * 🇮🇩 Konversi UTC timestamp ke waktu Jakarta (WIB)
 * @param {number|string|Date} timestamp
 * @returns {string} waktu dalam format "DD/MM/YYYY HH:mm:ss WIB"
 */
export function toJakartaTime(timestamp) {
  const formatted = formatTime(
    timestamp,
    "DD/MM/YYYY HH:mm:ss",
    "Asia/Jakarta"
  );
  return `${formatted} WIB`;
}

/**
 * 🧩 Konversi timestamp (ms / detik / Date) menjadi ISO string (UTC)
 * @param {number|bigint|string|Date} input
 * @returns {string} waktu ISO (misal: "2025-10-11T03:00:00.000Z")
 */
export function toISO(input) {
  try {
    if (!input) return dayjs().utc().toISOString();

    let ms;
    if (typeof input === "bigint") {
      ms = Number(input);
    } else if (typeof input === "string" && /^\d+$/.test(input)) {
      ms = Number(input);
    } else if (input instanceof Date) {
      ms = input.getTime();
    } else {
      ms = Number(input);
    }

    // Jika input dalam detik, ubah jadi milidetik
    if (ms < 1e12) ms *= 1000;

    return dayjs(ms).utc().toISOString();
  } catch (err) {
    console.error("❌ Error toISO:", err.message);
    return dayjs().utc().toISOString();
  }
}

/**
 * ⏱️ Ambil waktu candle terakhir yang SUDAH close (1 jam ke belakang dari jam UTC sekarang)
 * @returns {number} timestamp dalam milidetik
 */
export function getLastClosedHourlyCandleEndTime() {
  return dayjs().utc().startOf("hour").subtract(1, "hour").valueOf();
}

/**
 * ✅ Validasi waktu akhir agar tidak melebihi candle terakhir yang sudah close
 * @param {number} endTime
 * @returns {number} waktu akhir yang valid
 */
export function validateEndTime(endTime) {
  const lastClosed = getLastClosedHourlyCandleEndTime();
  return Math.min(endTime, lastClosed);
}
