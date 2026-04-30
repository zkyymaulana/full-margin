// service utama untuk membandingkan 3 strategi: single, multi, voting
import { prisma } from "../../lib/prisma.js";
import { backtestAllIndicators } from "../backtest/backtest.service.js";
import { backtestWithWeights } from "../multiIndicator/index.js";

import {
  validateComparisonParams,
  handleComparisonError,
} from "./comparison.validation.js";

import {
  calcSharpe,
  calculateReturns,
  formatResult,
} from "./comparison.metrics.js";

import { backtestVotingStrategy } from "./comparison.backtest.js";

import {
  mergeIndicatorsWithCandles,
  getBestWeights,
} from "./comparison.data.js";

export async function compareStrategies(
  symbol,
  startDate,
  endDate,
  _threshold = 0,
) {
  const executionThreshold = 0;
  const timeframe = "1h";

  console.log(
    `Comparison started for ${symbol} with execution threshold ${executionThreshold}`,
  );

  try {
    // validasi input
    const validation = validateComparisonParams({
      symbol,
      startDate,
      endDate,
    });

    if (!validation.isValid) {
      return {
        success: false,
        message: validation.error.message,
        example: validation.error.example,
      };
    }

    // ambil coin dan timeframe dari database
    const coin = await prisma.coin.findUnique({
      where: { symbol },
      select: { id: true },
    });

    if (!coin) {
      return {
        success: false,
        message: `Coin ${symbol} not found in database`,
      };
    }

    const timeframeRecord = await prisma.timeframe.findUnique({
      where: { timeframe },
      select: { id: true },
    });

    if (!timeframeRecord) {
      return {
        success: false,
        message: `Timeframe ${timeframe} not found in database`,
      };
    }

    const { coinId, timeframeId } = {
      coinId: coin.id,
      timeframeId: timeframeRecord.id,
    };

    // ambil data indicator dan candle
    const start = BigInt(new Date(startDate).getTime());
    const end = BigInt(new Date(endDate).getTime());

    const [indicators, candles] = await Promise.all([
      prisma.indicator.findMany({
        where: { coinId, timeframeId, time: { gte: start, lte: end } },
        orderBy: { time: "asc" },
      }),
      prisma.candle.findMany({
        where: { coinId, timeframeId, time: { gte: start, lte: end } },
        orderBy: { time: "asc" },
        select: { time: true, close: true },
      }),
    ]);

    if (!indicators.length || !candles.length)
      return {
        success: false,
        message: `No data found for ${symbol} in the specified period`,
      };

    // gabungkan indicator dan harga
    const data = mergeIndicatorsWithCandles(indicators, candles);
    if (!data.length)
      return { success: false, message: "Unable to merge indicator data" };

    // ambil bobot terbaik
    const { weights: bestWeights, source: weightSource } = await getBestWeights(
      symbol,
      timeframe,
    );

    console.log(`Using ${weightSource} weights`, bestWeights);

    // backtest single indicator
    console.log("Running single indicator backtests...");
    const singleResults = await backtestAllIndicators(data, { fastMode: true });

    // backtest multi-indicator weighted
    console.log(
      `Running multi indicator backtest with threshold ${executionThreshold}...`,
    );
    const multiResult = await backtestWithWeights(data, bestWeights, {
      fastMode: true,
      threshold: executionThreshold,
    });

    // backtest voting strategy
    console.log("Running voting strategy backtest...");
    const votingResult = backtestVotingStrategy(data);

    // format hasil
    console.log("📋 Formatting results with raw ROI values...");
    const singleFormatted = {};

    if (singleResults.results) {
      for (const r of singleResults.results) {
        if (r.success && r.performance) {
          console.log(
            `   ✓ ${r.indicator}: ROI=${r.performance.roi}%, Capital=${r.performance.finalCapital}, WinRate=${r.performance.winRate}%`,
          );
          singleFormatted[r.indicator] = formatResult(r.performance);
        } else {
          console.log(`   ✗ ${r.indicator}: No performance data`);
        }
      }
    }

    console.log(
      `Successfully formatted ${Object.keys(singleFormatted).length} indicators`,
    );

    const multiFormatted = formatResult(multiResult);
    const votingFormatted = formatResult(votingResult);

    // hitung sharpe ratio voting
    const votingReturns = calculateReturns(votingResult.equityCurve);
    votingFormatted.sharpeRatio = +calcSharpe(votingReturns).toFixed(2);

    console.log(`Multi-indicator Sharpe: ${multiFormatted.sharpeRatio}`);
    console.log(`Voting Strategy Sharpe: ${votingFormatted.sharpeRatio}`);

    // cari single indicator terbaik
    const validSingles =
      singleResults.results?.filter((r) => r.success && r.performance) || [];

    console.log(
      `Finding best single indicator from ${validSingles.length} valid results...`,
    );

    const bestSingle = validSingles.reduce(
      (best, cur) =>
        cur.performance.roi > (best?.performance?.roi ?? -Infinity)
          ? cur
          : best,
      null,
    );

    const bestSingleData = bestSingle
      ? {
          indicator: bestSingle.indicator,
          roi: +Number(bestSingle.performance.roi).toFixed(2),
          winRate: +Number(bestSingle.performance.winRate).toFixed(2),
          maxDrawdown: +Number(bestSingle.performance.maxDrawdown).toFixed(2),
          finalCapital: +Number(bestSingle.performance.finalCapital).toFixed(2),
        }
      : null;

    if (bestSingleData) {
      console.log(
        `Best single indicator: ${bestSingleData.indicator} with ${bestSingleData.roi}% ROI and $${bestSingleData.finalCapital} final capital`,
      );
    } else {
      console.warn("No valid single indicator results found!");
    }

    // tentukan strategi terbaik
    const strategies = [
      { name: "single", roi: bestSingleData?.roi ?? -Infinity },
      { name: "multi", roi: multiFormatted.roi },
      { name: "voting", roi: votingFormatted.roi },
    ];

    const bestStrategy = strategies.reduce((best, cur) =>
      cur.roi > best.roi ? cur : best,
    );

    console.log(`\nSTRATEGY COMPARISON:`);
    console.log(
      `   Single (${bestSingleData?.indicator}): ${bestSingleData?.roi}% ROI, $${bestSingleData?.finalCapital}`,
    );
    console.log(
      `   Multi-Weighted: ${multiFormatted.roi}% ROI, $${multiFormatted.finalCapital}`,
    );
    console.log(
      `   Voting: ${votingFormatted.roi}% ROI, $${votingFormatted.finalCapital}`,
    );
    console.log(`   Winner: ${bestStrategy.name.toUpperCase()}`);

    // build analisis tambahan
    const startObj = new Date(Number(candles[0].time));
    const endObj = new Date(Number(candles[candles.length - 1].time));
    const days = Math.ceil((endObj - startObj) / (1000 * 60 * 60 * 24));

    const analysis = {
      periodDays: days,
      candles: candles.length,
      dataPoints: data.length,
      bestSingle: bestSingleData,
      multiBeatsBestSingle: bestSingleData
        ? multiFormatted.roi > bestSingleData.roi
        : false,
      votingBeatsBestSingle: bestSingleData
        ? votingFormatted.roi > bestSingleData.roi
        : false,
      roiDifference: bestSingleData
        ? +(multiFormatted.roi - bestSingleData.roi).toFixed(2)
        : null,
      winRateComparison: bestSingleData
        ? {
            multi: multiFormatted.winRate,
            bestSingle: bestSingleData.winRate,
            difference: +(
              multiFormatted.winRate - bestSingleData.winRate
            ).toFixed(2),
          }
        : null,
      votingComparison: {
        votingROI: votingFormatted.roi,
        multiROI: multiFormatted.roi,
        difference: +(votingFormatted.roi - multiFormatted.roi).toFixed(2),
        votingWinRate: votingFormatted.winRate,
        multiWinRate: multiFormatted.winRate,
      },
    };

    console.log("Comparison finished successfully");

    // return response akhir
    return {
      success: true,
      symbol,
      timeframe,
      period: {
        start: startObj.toISOString(),
        end: endObj.toISOString(),
        days,
      },
      comparison: {
        single: singleFormatted,
        multi: multiFormatted,
        voting: votingFormatted,
      },
      bestStrategy: {
        name: bestStrategy.name,
        roi: bestStrategy.roi,
      },
      analysis,
    };
  } catch (error) {
    const { statusCode, response } = handleComparisonError(error);
    return response;
  }
}
