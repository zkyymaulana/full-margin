// fungsi untuk validasi parameter comparison/backtest
const DATASET_MIN_START_DATE = new Date("2020-01-01T00:00:00Z");

export function validateComparisonParams({ symbol, startDate, endDate }) {
  // cek symbol
  if (!symbol || typeof symbol !== "string" || symbol.trim() === "") {
    return {
      isValid: false,
      error: {
        message: "Symbol harus berupa string dan tidak boleh kosong",
        example: "BTC-USD, ETH-USD, SOL-USD",
      },
    };
  }

  // cek startDate dan endDate
  if (!startDate || !endDate) {
    return {
      isValid: false,
      error: {
        message: "startDate dan endDate harus disediakan",
        example: 'startDate: "2024-01-01", endDate: "2024-12-31"',
      },
    };
  }

  // cek format ISO
  const isoPattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(.\d{3})?Z?)?$/;

  if (!isoPattern.test(startDate)) {
    return {
      isValid: false,
      error: {
        message: `startDate "${startDate}" tidak valid`,
        example: "2024-01-01 atau 2024-01-01T00:00:00Z",
      },
    };
  }

  if (!isoPattern.test(endDate)) {
    return {
      isValid: false,
      error: {
        message: `endDate "${endDate}" tidak valid`,
        example: "2024-01-01 atau 2024-01-01T00:00:00Z",
      },
    };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // cek batas minimal dataset
  if (start < DATASET_MIN_START_DATE) {
    return {
      isValid: false,
      error: {
        message: "startDate tidak boleh sebelum 2020-01-01",
        example: "Gunakan startDate >= 2020-01-01",
      },
    };
  }

  // cek urutan tanggal
  if (start >= end) {
    return {
      isValid: false,
      error: {
        message: "startDate harus lebih kecil dari endDate",
        example: "startDate: 2024-01-01, endDate: 2024-12-31",
      },
    };
  }

  // cek minimal range 7 hari
  const rangeMs = end - start;
  const minRangeMs = 7 * 24 * 60 * 60 * 1000;

  if (rangeMs < minRangeMs) {
    return {
      isValid: false,
      error: {
        message: "Range minimal 7 hari",
        example: "Gunakan rentang >= 7 hari",
      },
    };
  }

  return { isValid: true };
}

// menangani error dari proses comparison/backtest
export function handleComparisonError(error) {
  console.error("Comparison Error:", error);

  // error database (data tidak ditemukan)
  if (error.code === "P2025") {
    return {
      statusCode: 404,
      response: {
        success: false,
        message: "Data tidak ditemukan di database",
        type: "NOT_FOUND",
      },
    };
  }

  // error validasi input
  if (
    error.message?.includes("validation") ||
    error.message?.includes("valid")
  ) {
    return {
      statusCode: 400,
      response: {
        success: false,
        message: error.message,
        type: "VALIDATION_ERROR",
      },
    };
  }

  // error saat proses backtest / perhitungan
  if (
    error.message?.includes("backtest") ||
    error.message?.includes("calculation") ||
    error.message?.includes("merge")
  ) {
    return {
      statusCode: 422,
      response: {
        success: false,
        message: `Proses backtesting gagal: ${error.message}`,
        type: "PROCESSING_ERROR",
      },
    };
  }

  // error lain (default)
  return {
    statusCode: 500,
    response: {
      success: false,
      message: error.message || "Terjadi kesalahan pada server",
      type: "SYSTEM_ERROR",
    },
  };
}
