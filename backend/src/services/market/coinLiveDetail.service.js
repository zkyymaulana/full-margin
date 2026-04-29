// detail live per coin
import { prisma } from "../../lib/prisma.js";
import { fetchTicker } from "./coinbase.service.js";
import { getLastTicker } from "../websocket/websocket.service.js";

/**
 * Ambil detail harga live coin
 * Prioritas:
 * 1. Ambil dari API external (ticker realtime)
 * 2. Jika gagal, fallback ke data terakhir di database (candle terbaru)
 */
export async function getCoinLiveDetail(symbol) {
  try {
    const cachedTicker = getLastTicker(symbol);
    if (cachedTicker) {
      return {
        success: true,
        data: cachedTicker,
      };
    }

    // Ambil data live dari API
    const t = await fetchTicker(symbol);

    // Jika berhasil, langsung return data realtime
    if (t) return { success: true, data: t };

    // Jika API gagal / tidak ada data → fallback ke database
    const coin = await prisma.coin.findUnique({
      where: { symbol },

      // Ambil candle terakhir (data paling baru)
      include: {
        candles: {
          orderBy: { time: "desc" }, // urutkan dari terbaru
          take: 1, // ambil 1 data saja
        },
      },
    });

    // Jika tidak ada data sama sekali di DB
    if (!coin?.candles?.[0]) {
      return {
        success: false,
        message: `Data ${symbol} tidak ditemukan`,
      };
    }

    // Return data dari candle terakhir sebagai fallback
    return {
      success: true,
      data: {
        symbol,
        price: coin.candles[0].close, // harga penutupan terakhir
        volume: coin.candles[0].volume, // volume terakhir
        time: Number(coin.candles[0].time), // timestamp candle
      },
    };
  } catch (e) {
    // Handle error jika terjadi masalah (API/DB)
    console.error(`getCoinLiveDetail error: ${e.message}`);

    return {
      success: false,
      message: e.message,
    };
  }
}
