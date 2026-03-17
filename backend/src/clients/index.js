/**
 * File: src/clients/index.js
 * -------------------------------------------------
 * Tujuan: Barrel export (satu pintu) untuk semua external API client.
 * Service layer bisa import dari file ini supaya lebih rapi.
 */

export * from "./coinbase.client.js";
export * from "./coinmarketcap.client.js";
