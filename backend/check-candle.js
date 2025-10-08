/**
 * 🔍 Check Candle Script - Bandingkan data Coinbase dengan TradingView
 * @description Script untuk mengecek data candle jam 17:00 WIB langsung dari Coinbase API
 */

import axios from "axios";

async function checkSpecificCandle() {
  try {
    console.log("🔍 Mengecek candle jam 17:00 WIB dari Coinbase API...");
    console.log("=".repeat(60));

    // Coba beberapa parameter waktu untuk mencari candle jam 17:00 WIB
    const testTimes = [
      {
        start: "2025-10-08T09:00:00Z",
        end: "2025-10-08T10:00:00Z",
        label: "16:00-17:00 WIB",
      },
      {
        start: "2025-10-08T10:00:00Z",
        end: "2025-10-08T11:00:00Z",
        label: "17:00-18:00 WIB",
      },
      {
        start: "2025-10-08T11:00:00Z",
        end: "2025-10-08T12:00:00Z",
        label: "18:00-19:00 WIB",
      },
    ];

    for (const time of testTimes) {
      console.log(`\n🕐 Test ${time.label}:`);

      const response = await axios.get(
        "https://api.exchange.coinbase.com/products/BTC-USD/candles",
        {
          params: {
            start: time.start,
            end: time.end,
            granularity: 3600,
          },
          timeout: 10000,
        }
      );

      if (response.data && response.data.length > 0) {
        const candle = response.data[0];
        const timestamp = candle[0];
        const open = candle[3];

        const date = new Date(timestamp * 1000);
        const wibTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);

        console.log(`   Timestamp: ${timestamp}`);
        console.log(
          `   Waktu WIB: ${wibTime.toISOString().replace("Z", "").replace("T", " ")} WIB`
        );
        console.log(
          `   Open: $${open.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
        );

        // Cek apakah ini candle jam 17:00 WIB yang kita cari
        if (wibTime.getUTCHours() === 17 && wibTime.getUTCMinutes() === 0) {
          console.log(`   ✅ INI CANDLE JAM 17:00 WIB!`);
          console.log(
            `   📊 Data: Open=$${open}, Target TradingView=$122,537.62`
          );
          console.log(
            `   📊 Selisih: $${Math.abs(open - 122537.62).toFixed(2)}`
          );
        }
      } else {
        console.log(`   ⚠️ Tidak ada data`);
      }
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

// Jalankan fungsi
checkSpecificCandle();
