// src/controllers/marketcap.controller.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * 🔹 Helper: Konversi BigInt ke Number agar bisa dikirim ke JSON
 */
function convertBigIntToNumber(obj) {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? Number(value) : value
    )
  );
}

/**
 * 📊 Ambil data marketcap dari tabel Coin + Candle terakhir
 */
export async function getMarketcap(req, res) {
  try {
    const coins = await prisma.coin.findMany({
      include: {
        candles: {
          orderBy: { time: "desc" },
          take: 1,
        },
      },
      orderBy: { id: "asc" },
      take: 100,
    });

    // ✅ konversi BigInt ke Number sebelum dikirim
    const cleanData = convertBigIntToNumber(coins);

    res.json({
      success: true,
      total: cleanData.length,
      data: cleanData,
    });
  } catch (err) {
    console.error("❌ Error getMarketcap:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    await prisma.$disconnect();
  }
}
