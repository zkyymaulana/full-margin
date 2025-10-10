import { getExactMatchedPairs } from "../services/marketcap.service.js";

export async function getMarketcap(req, res) {
  try {
    const result = await getExactMatchedPairs();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data marketcap",
      error: err.message,
    });
  }
}
