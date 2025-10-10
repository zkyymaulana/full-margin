// src/services/candle.service.js
const API_BASE_URL = "http://localhost:8000";

export async function getCandles(symbol = "BTC-USD") {
  try {
    console.log(`🔌 Fetching candles for ${symbol} from API...`);

    const response = await fetch(
      `${API_BASE_URL}/api/chart/${symbol}?limit=500`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    console.log(`📊 API Response:`, {
      success: data.success,
      symbol: data.symbol,
      totalCandles: data.totalCandles,
      returned: data.returned,
      candlesLength: data.candles?.length,
    });

    if (!data.success) {
      throw new Error(data.message || "Failed to fetch candles");
    }

    return data; // Return the complete response object
  } catch (error) {
    console.error("❌ Error fetching candles:", error);
    throw error;
  }
}
