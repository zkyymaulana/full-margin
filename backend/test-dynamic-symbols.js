/**
 * 🧪 Test Script untuk Dynamic Hourly Loop
 * @description Script untuk menguji endpoint dinamis dengan berbagai symbol
 */

import { getCoinbaseHourlyLoop } from "./src/services/data.service.js";

async function testDynamicSymbols() {
  const symbols = ["BTC-USD", "ETH-USD", "SOL-USD"];

  console.log(
    "🧪 Testing Dynamic getCoinbaseHourlyLoop() with multiple symbols..."
  );
  console.log("=".repeat(70));

  for (const symbol of symbols) {
    try {
      console.log(`\n🚀 Testing ${symbol}...`);
      console.log("-".repeat(50));

      const startTime = Date.now();
      const result = await getCoinbaseHourlyLoop(symbol);
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      console.log("✅ Success!");
      console.log(`   Symbol: ${result.symbol}`);
      console.log(`   Total candles: ${result.totalCandles.toLocaleString()}`);
      console.log(`   Duration: ${duration} seconds`);
      console.log(`   Saved to: ${result.savedTo}`);

      if (result.data.length > 0) {
        const firstCandle = result.data[0];
        const lastCandle = result.data[result.data.length - 1];

        console.log(
          `   First candle: ${new Date(firstCandle.time * 1000).toISOString()}`
        );
        console.log(
          `   Last candle: ${new Date(lastCandle.time * 1000).toISOString()}`
        );
        console.log(`   First price: $${firstCandle.close}`);
        console.log(`   Last price: $${lastCandle.close}`);
      }
    } catch (error) {
      console.error(`❌ Test failed for ${symbol}:`, error.message);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("🎉 Dynamic symbol testing completed!");
  console.log("\n📝 Usage examples:");
  console.log("   - GET /api/hourly-loop/BTC-USD");
  console.log("   - GET /api/hourly-loop/ETH-USD");
  console.log("   - GET /api/hourly-loop/SOL-USD");
  console.log("   - GET /api/hourly-loop (defaults to BTC-USD)");
  console.log("   - GET /api/btc-hourly-loop (legacy endpoint)");
}

// Run the test
testDynamicSymbols();
