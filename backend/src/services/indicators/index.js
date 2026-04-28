import { createSMACalculator } from "./sma.service.js";
import { createEMACalculator } from "./ema.service.js";
import { createMACDCalculator } from "./macd.service.js";
import { createParabolicSARCalculator } from "./psar.service.js";

import { createRSICalculator } from "./rsi.service.js";
import { createStochasticCalculator } from "./stochastic.service.js";
import { createStochasticRSICalculator } from "./stochRsi.service.js";

import { createBollingerBandsCalculator } from "./bollinger.service.js";
import {
  formatIndicatorStructure,
  formatPerformanceData,
} from "./indicator.formatter.js";

import {
  calculateAndSaveIndicators,
  getCoinAndTimeframeIds,
  getLatestSignalData,
  getPaginatedIndicators,
  getCandlePrices,
  organizeIndicatorData,
  buildIndicatorPagination,
  buildLatestSignal,
  buildResponseMetadata,
  getPaginatedSignalData,
} from "./indicator.service.js";

export {
  createSMACalculator, // Buat kalkulator SMA
  createEMACalculator, // Buat kalkulator EMA
  createMACDCalculator, // Buat kalkulator MACD
  createParabolicSARCalculator, // Buat kalkulator Parabolic SAR
  createRSICalculator, // Buat kalkulator RSI
  createStochasticCalculator, // Buat kalkulator Stochastic
  createStochasticRSICalculator, // Buat kalkulator Stochastic RSI
  createBollingerBandsCalculator, // Buat kalkulator Bollinger Bands
  calculateAndSaveIndicators, // Hitung dan simpan indikator ke database
  getCoinAndTimeframeIds, // Ambil coinId dan timeframeId
  getLatestSignalData, // Ambil sinyal indikator terbaru
  formatIndicatorStructure, // Format struktur indikator untuk response
  formatPerformanceData, // Format data performa bobot indikator
  getPaginatedIndicators, // Ambil data indikator per halaman
  getCandlePrices, // Ambil harga candle berdasarkan rentang waktu
  organizeIndicatorData, // Susun data indikator agar mudah dipakai UI
  buildIndicatorPagination, // Bentuk metadata pagination indikator
  buildLatestSignal, // Bentuk ringkasan sinyal terbaru
  buildResponseMetadata, // Bentuk metadata response indikator
  getPaginatedSignalData, // Ambil paket data sinyal + harga + bobot
};
