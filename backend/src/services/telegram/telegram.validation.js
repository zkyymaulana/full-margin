/**
 * File: telegram.validation.js
 * -------------------------------------------------
 * Tujuan: Menyediakan fungsi validasi dan builder payload untuk kebutuhan broadcast sinyal.
 * Catatan: Refactor ini bersifat struktural saja (tidak mengubah perilaku).
 */

/**
 * Validasi parameter request untuk broadcast sinyal.
 *
 * @param {object} params
 * @param {string} params.symbol - Simbol koin (wajib)
 * @param {string} params.signal - Jenis sinyal (wajib)
 * @param {number} params.price - Harga (wajib, number positif)
 * @returns {true} Mengembalikan true jika valid.
 * @throws {Error} Jika ada parameter yang tidak valid.
 */
export function validateBroadcastSignalParams(params) {
  const { symbol, signal, price } = params;

  if (!symbol || !signal || !price) {
    throw new Error("symbol, signal, and price are required");
  }

  // Validasi nilai signal
  const validSignals = ["buy", "sell", "neutral", "strong_buy", "strong_sell"];
  if (!validSignals.includes(signal.toLowerCase())) {
    throw new Error(
      `Invalid signal. Must be one of: ${validSignals.join(", ")}`
    );
  }

  // Validasi tipe dan range price
  if (typeof price !== "number" || isNaN(price) || price <= 0) {
    throw new Error("price must be a positive number");
  }

  return true;
}

/**
 * Membangun payload broadcast sinyal dengan default.
 *
 * Struktur payload:
 * - symbol: uppercase
 * - signal: lowercase
 * - price: number
 * - type: selalu "multi" (sesuai perilaku sebelumnya)
 * - details: disatukan dan ditambah timestamp
 *
 * @param {object} params
 * @param {string} params.symbol
 * @param {string} params.signal
 * @param {number} params.price
 * @param {object} [params.details]
 * @returns {object} Payload siap untuk broadcast.
 */
export function buildBroadcastSignalPayload(params) {
  const { symbol, signal, price, details = {} } = params;

  return {
    symbol: symbol.toUpperCase(),
    signal: signal.toLowerCase(),
    price,
    type: "multi", // Always multi
    details: {
      ...details,
      timestamp: new Date().toISOString(),
    },
  };
}
