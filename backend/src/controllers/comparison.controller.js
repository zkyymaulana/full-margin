import {
  compareStrategies,
  validateComparisonParams,
  handleComparisonError,
} from "../services/comparison/index.js";

// Bandingkan performa beberapa strategi indikator dalam rentang waktu tertentu.
export const compareIndicators = async (req, res) => {
  try {
    // Validasi input request sebelum proses perbandingan.
    const validation = validateComparisonParams(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        ...validation.error,
      });
    }

    const { symbol, startDate, endDate, threshold = 0 } = req.body;

    // Jalankan business logic perbandingan di service layer.
    const result = await compareStrategies(
      symbol,
      startDate,
      endDate,
      threshold,
    );

    // Jika service gagal menemukan data, kirim status not found.
    if (!result.success) {
      return res.status(404).json(result);
    }

    // Response sukses langsung mengembalikan payload dari service.
    // Kirim hasil perbandingan jika sukses.
    return res.status(200).json(result);
  } catch (error) {
    // Gunakan error handler terpusat agar response konsisten.
    const { statusCode, response } = handleComparisonError(error);
    return res.status(statusCode).json(response);
  }
};
