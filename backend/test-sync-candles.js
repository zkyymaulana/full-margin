import { syncCoinbaseCandles } from "./src/controllers/candle.controller.js";

(async () => {
  const result = await syncCoinbaseCandles("ETH-USD");
  console.log(result);
})();
