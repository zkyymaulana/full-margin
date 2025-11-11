// detail live per coin
import { prisma } from "../../lib/prisma.js";
import { fetchTicker } from "./coinbase.service.js";

/**
 * Ambil detail live 1 coin (untuk chart)
 */
export async function getCoinLiveDetail(symbol) {
  try {
    const t = await fetchTicker(symbol);
    if (t) return { success: true, data: t };

    const coin = await prisma.coin.findUnique({
      where: { symbol },
      include: { candles: { orderBy: { time: "desc" }, take: 1 } },
    });

    if (!coin?.candles?.[0])
      return { success: false, message: `Data ${symbol} tidak ditemukan` };

    return {
      success: true,
      data: {
        symbol,
        price: coin.candles[0].close,
        volume: coin.candles[0].volume,
        time: Number(coin.candles[0].time),
      },
    };
  } catch (e) {
    console.error(`❌ getCoinLiveDetail error: ${e.message}`);
    return { success: false, message: e.message };
  }
}
