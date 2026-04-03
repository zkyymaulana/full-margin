/**
 * ═══════════════════════════════════════════════════════════════
 * ✅ COMPARISON VALIDATION MODULE
 * ═══════════════════════════════════════════════════════════════
 *
 * Modul ini bertanggung jawab untuk:
 * • Validasi parameter request dari user
 * • Pengecekan format tanggal (ISO 8601)
 * • Pengecekan symbol cryptocurrency yang valid
 * • Error handling dan error response formatting
 * • Memberikan contoh format yang benar untuk error messages
 *
 * Tujuan:
 * - Ensure input data valid sebelum proses backtesting
 * - Provide helpful error messages dengan contoh
 * - Prevent invalid data dari entering comparison pipeline
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * ✅ Validasi parameter request comparison
 *
 * Tujuan:
 * - Check apakah semua required parameters ada
 * - Validate format dari setiap parameter
 * - Ensure date logic valid (startDate < endDate)
 * - Provide helpful error messages
 *
 * Validasi yang dilakukan:
 * 1. Check symbol tidak empty dan valid format
 * 2. Check startDate dan endDate ada
 * 3. Check format ISO 8601 (YYYY-MM-DD atau ISO full)
 * 4. Check startDate < endDate (logical order)
 * 5. Check date range tidak terlalu lama (max 1 tahun)
 * 6. Check date range tidak terlalu pendek (min 7 hari)
 *
 *
 *
 * @example
 * // ✅ Valid request
 * validateComparisonParams({
 *   symbol: "BTC-USD",
 *   startDate: "2024-01-01",
 *   endDate: "2024-12-31"
 * })
 * // Returns: { isValid: true }
 *
 * @example
 * // ❌ Invalid date format
 * validateComparisonParams({
 *   symbol: "BTC-USD",
 *   startDate: "01/01/2024",
 *   endDate: "31/12/2024"
 * })
 * // Returns: { isValid: false, error: { message: "...", example: "2024-01-01" } }
 */
function validateComparisonParams({ symbol, startDate, endDate }) {
  // ═══════════════════════════════════════════════════════════════
  // ✅ VALIDASI 1: Check symbol
  // ═══════════════════════════════════════════════════════════════

  if (!symbol || typeof symbol !== "string" || symbol.trim() === "") {
    return {
      isValid: false,
      error: {
        message: "Symbol harus berupa string dan tidak boleh kosong",
        example: "BTC-USD, ETH-USD, SOL-USD",
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ✅ VALIDASI 2: Check startDate dan endDate ada
  // ═══════════════════════════════════════════════════════════════

  if (!startDate || !endDate) {
    return {
      isValid: false,
      error: {
        message: "startDate dan endDate harus disediakan",
        example: 'startDate: "2024-01-01", endDate: "2024-12-31"',
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ✅ VALIDASI 3: Check format ISO 8601
  // ═══════════════════════════════════════════════════════════════

  // ✅ Pattern untuk ISO 8601: YYYY-MM-DD atau lengkap dengan waktu
  const isoPattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(.\d{3})?Z?)?$/;

  if (!isoPattern.test(startDate)) {
    return {
      isValid: false,
      error: {
        message: `startDate "${startDate}" tidak valid. Format harus ISO 8601`,
        example: "2024-01-01 atau 2024-01-01T00:00:00Z",
      },
    };
  }

  if (!isoPattern.test(endDate)) {
    return {
      isValid: false,
      error: {
        message: `endDate "${endDate}" tidak valid. Format harus ISO 8601`,
        example: "2024-01-01 atau 2024-01-01T00:00:00Z",
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ✅ VALIDASI 4: Check startDate < endDate (logical order)
  // ═══════════════════════════════════════════════════════════════

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start >= end) {
    return {
      isValid: false,
      error: {
        message: `startDate (${startDate}) harus lebih kecil dari endDate (${endDate})`,
        example: "startDate: 2024-01-01, endDate: 2024-12-31",
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ✅ VALIDASI 5: Check date range tidak terlalu lama (max 1 tahun)
  // ═══════════════════════════════════════════════════════════════

  const maxRangeMs = 365 * 24 * 60 * 60 * 1000; // 1 tahun
  const rangeMs = end - start;

  if (rangeMs > maxRangeMs) {
    return {
      isValid: false,
      error: {
        message: `Date range terlalu panjang (${Math.round(rangeMs / (1000 * 60 * 60 * 24))} hari > 365 hari)`,
        example: "Maksimal 365 hari per backtest",
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ✅ VALIDASI 6: Check date range tidak terlalu pendek (min 7 hari)
  // ═══════════════════════════════════════════════════════════════

  const minRangeMs = 7 * 24 * 60 * 60 * 1000; // 7 hari
  if (rangeMs < minRangeMs) {
    return {
      isValid: false,
      error: {
        message: `Date range terlalu pendek (${Math.round(rangeMs / (1000 * 60 * 60 * 24))} hari < 7 hari)`,
        example: "Minimal 7 hari untuk meaningful backtest",
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ✅ SEMUA VALIDASI PASSED
  // ═══════════════════════════════════════════════════════════════

  return { isValid: true };
}

/**
 * ❌ Penanganan error pada service comparison
 *
 * Tujuan:
 * - Catch errors dari backtesting process
 * - Map error ke response yang sesuai
 * - Provide helpful error messages ke user
 * - Log error untuk debugging
 *
 * Error categories:
 * 1. Database errors (data not found, query errors)
 * 2. Validation errors (invalid input)
 * 3. Processing errors (backtest fail, calculation error)
 * 4. System errors (unknown/unexpected errors)
 *
 *
 *
 * @example
 * try {
 *   // some operation
 * } catch (error) {
 *   const { statusCode, response } = handleComparisonError(error);
 *   return res.status(statusCode).json(response);
 * }
 */
function handleComparisonError(error) {
  console.error("❌ Comparison Error:", error);

  // ═══════════════════════════════════════════════════════════════
  // ERROR TYPE 1: Database Errors
  // ═══════════════════════════════════════════════════════════════

  if (error.code === "P2025") {
    // Prisma "not found" error
    return {
      statusCode: 404,
      response: {
        success: false,
        message: "Data tidak ditemukan di database",
        type: "NOT_FOUND",
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ERROR TYPE 2: Validation Errors
  // ═══════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════
  // ERROR TYPE 3: Processing Errors (Backtest, Calculation)
  // ═══════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════
  // ERROR TYPE 4: Unknown/System Errors
  // ═══════════════════════════════════════════════════════════════

  return {
    statusCode: 500,
    response: {
      success: false,
      message: error.message || "Terjadi kesalahan pada server",
      type: "SYSTEM_ERROR",
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════

export { validateComparisonParams, handleComparisonError };
