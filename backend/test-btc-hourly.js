/**
 * 🧪 Test Script untuk getCoinbaseHourlyLoop()
 * @description Script standalone untuk menjalankan fungsi pengambilan data BTC-USD
 *              dari 1 Oktober 2020 sampai sekarang dengan batch looping otomatis.
 *
 * Cara menjalankan:
 * node test-btc-hourly.js
 */

import { getCoinbaseHourlyLoop } from "./src/services/data.service.js";

async function main() {
  try {
    console.log("🧪 Testing getCoinbaseHourlyLoop() function...");
    console.log("=".repeat(60));

    const startTime = Date.now();
    const allCandles = await getCoinbaseHourlyLoop();
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("=".repeat(60));
    console.log("🎉 Test completed successfully!");
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📊 Total candles collected: ${allCandles.length}`);
    console.log(`💾 Data saved to: ./data/data-btcusd-1h.json`);

    if (allCandles.length > 0) {
      const firstCandle = allCandles[0];
      const lastCandle = allCandles[allCandles.length - 1];

      console.log(
        `📅 First candle: ${new Date(firstCandle.time * 1000).toISOString()}`
      );
      console.log(
        `📅 Last candle: ${new Date(lastCandle.time * 1000).toISOString()}`
      );
      console.log(`💰 First price: $${firstCandle.close}`);
      console.log(`💰 Last price: $${lastCandle.close}`);
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

// Run the test
main();
