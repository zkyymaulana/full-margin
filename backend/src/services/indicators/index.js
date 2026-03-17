import { createSMACalculator } from "./sma.service.js";
import { createEMACalculator } from "./ema.service.js";
import { createMACDCalculator } from "./macd.service.js";
import { createParabolicSARCalculator } from "./psar.service.js";

import { createRSICalculator } from "./rsi.service.js";
import { createStochasticCalculator } from "./stochastic.service.js";
import { createStochasticRSICalculator } from "./stochRsi.service.js";

import { createBollingerBandsCalculator } from "./bollinger.service.js";

import {
  calculateAndSaveIndicators,
  getCoinAndTimeframeIds,
  getLatestSignalData,
  formatIndicatorStructure,
  formatPerformanceData,
  getPaginatedIndicators,
  getCandlePrices,
  organizeIndicatorData,
  buildIndicatorPagination,
  buildLatestSignal,
  buildResponseMetadata,
  getPaginatedSignalData,
} from "./indicator.service.js";

export {
  createSMACalculator,
  createEMACalculator,
  createMACDCalculator,
  createParabolicSARCalculator,
  createRSICalculator,
  createStochasticCalculator,
  createStochasticRSICalculator,
  createBollingerBandsCalculator,
  calculateAndSaveIndicators,
  getCoinAndTimeframeIds,
  getLatestSignalData,
  formatIndicatorStructure,
  formatPerformanceData,
  getPaginatedIndicators,
  getCandlePrices,
  organizeIndicatorData,
  buildIndicatorPagination,
  buildLatestSignal,
  buildResponseMetadata,
  getPaginatedSignalData,
};
