/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📊 CHART METADATA - STATISTICS & PAGINATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * TUJUAN MODUL:
 * ─────────────
 * Modul ini menangani perhitungan statistik dan metadata untuk chart response.
 * Tanggung jawab utama:
 * • Hitung coverage data (berapa banyak candle yang punya indicator)
 * • Hitung signal distribution (jumlah BUY, SELL, NEUTRAL signal)
 * • Format time range dalam format yang readable
 * • Build pagination URLs untuk next/prev page
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * 📈 Hitung metadata statistik untuk chart data
 *
 * ────────────────────────────────────────────────────────────
 * Tujuan:
 * Menganalisis dataset chart dan menghasilkan statistik:
 * • Coverage: berapa persen candle yang memiliki indicator data
 * • Signal Distribution: berapa banyak setiap jenis signal (BUY/SELL/NEUTRAL)
 * • Time Range: start dan end time dalam format yang readable
 *
 * Parameter:
 *   Struktur: { time, multiSignal: { signal }, ... }
 *
 * Return:
 *   {
 *     coverage: "100/500",              // "dengan_indicator/total"
 *     coveragePercent: "100.0%",        // Persentase data coverage
 *     signalDistribution: {
 *       buy: 50,                        // Jumlah candle dengan signal BUY + STRONG BUY
 *       sell: 30,                       // Jumlah candle dengan signal SELL + STRONG SELL
 *       neutral: 20,                    // Jumlah candle dengan signal NEUTRAL
 *       missing: 0                      // Jumlah candle tanpa multiSignal
 *     },
 *     source: "database",               // Data source indicator
 *     range: {
 *       start: "16 Maret 2026, 10:30",  // Human-readable start time (ID locale)
 *       end: "17 Maret 2026, 14:45"     // Human-readable end time (ID locale)
 *     }
 *   }
 *
 * ────────────────────────────────────────────────────────────
 */
export function calculateMetadata(merged, minTime, maxTime) {
  // ✅ Hitung berapa banyak candle yang memiliki indicator data
  const withIndicators = merged.filter((m) => m.indicators).length;

  // ✅ Hitung coverage percentage
  const coverage = (withIndicators / merged.length) * 100;

  // ✅ Hitung signal distribution (jumlah setiap jenis signal)
  // Strong signal digabung ke bucket buy/sell agar statistik arah pasar tidak bias.
  const signalStats = {
    buy: merged.filter((m) =>
      ["buy", "strong_buy"].includes(m.multiSignal?.signal),
    ).length,
    sell: merged.filter((m) =>
      ["sell", "strong_sell"].includes(m.multiSignal?.signal),
    ).length,
    neutral: merged.filter((m) => m.multiSignal?.signal === "neutral").length,
    missing: merged.filter((m) => !m.multiSignal).length,
  };

  // ✅ Return metadata dengan format yang readable
  return {
    // Coverage data - berapa persen candle yang punya indicator
    coverage: `${withIndicators}/${merged.length}`,
    coveragePercent: `${coverage.toFixed(1)}%`,

    // Signal distribution - breakdown dari signal types
    signalDistribution: signalStats,

    // Source indicator data
    source: "database",

    // Time range dalam format yang readable untuk UI
    range: {
      // Format: "16 Maret 2026, 10:30" (Indonesia locale)
      start: new Date(minTime).toLocaleString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      // Format: "17 Maret 2026, 14:45"
      end: new Date(maxTime).toLocaleString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  };
}

/**
 * 🔗 Build pagination URLs untuk navigasi next/previous page
 *
 * ────────────────────────────────────────────────────────────
 * Tujuan:
 * Membuat URL links untuk pagination sehingga frontend bisa
 * navigate ke halaman sebelumnya atau sesudahnya tanpa harus
 * reconstruct URL secara manual.
 *
 * Parameter:
 *   Dipakai untuk: protocol, host, baseUrl, path
 *
 * Return:
 *   {
 *     next: {
 *       page: 2,
 *       url: "http://localhost:3000/api/chart/BTC?page=2&limit=1000&timeframe=1h"
 *     } or null,
 *     prev: {
 *       page: 1,
 *       url: "http://localhost:3000/api/chart/BTC?page=1&limit=1000&timeframe=1h"
 *     } or null
 *   }
 *
 * Logika:
 * - next: null jika sudah di last page
 * - prev: null jika sudah di first page (page 1)
 *
 * ────────────────────────────────────────────────────────────
 */
export function buildPagination(req, page, totalPages, limit, timeframe) {
  // ✅ Build base URL dari request object
  const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

  // ✅ Build NEXT page link (jika tidak di last page)
  const next =
    page < totalPages
      ? {
          page: page + 1,
          // Construct full URL dengan query params
          url: `${baseUrl}?page=${page + 1}&limit=${limit}&timeframe=${timeframe}`,
        }
      : null; // Null jika sudah di last page

  // ✅ Build PREVIOUS page link (jika tidak di first page)
  const prev =
    page > 1
      ? {
          page: page - 1,
          // Construct full URL dengan query params
          url: `${baseUrl}?page=${page - 1}&limit=${limit}&timeframe=${timeframe}`,
        }
      : null; // Null jika sudah di first page

  return { next, prev };
}
