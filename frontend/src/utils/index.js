// Barrel file utilitas frontend dengan explicit named exports.
// Pola ini memudahkan discoverability dan menghindari wildcard export.

export {
  getBaseChartOptions, // Opsi dasar chart (layout, grid, crosshair, dll).
  getTimeScaleOptions, // Opsi time scale untuk sinkronisasi panel chart.
  overlayIndicators, // Daftar indikator overlay (SMA, EMA, Bollinger, PSAR).
  oscillatorIndicators, // Daftar oscillator (RSI, MACD, Stochastic, Stochastic RSI).
  getIndicatorValue, // Ambil nilai indikator utama dari satu candle.
  getIndicatorValueByPeriod, // Ambil nilai indikator berdasarkan period tertentu.
  formatPrice as formatChartPrice, // Formatter harga khusus util chartConfig.
  formatNumber as formatChartNumber, // Formatter angka umum khusus util chartConfig.
  formatVolume as formatChartVolume, // Formatter volume khusus util chartConfig.
  getCleanSeriesOptions, // Opsi style series minimalis.
} from "./chartConfig";

export {
  mergeCandlesData, // Gabungkan data lama-baru tanpa duplikasi timestamp.
  transformCandleData, // Ubah data API ke format Lightweight Charts.
  isNearLeftEdge, // Cek viewport dekat sisi kiri (muat data lebih lama).
  isNearRightEdge, // Cek viewport dekat sisi kanan (muat data lebih baru).
  debounce, // Batasi pemanggilan fungsi beruntun.
  calculatePreservedRange, // Jaga posisi viewport setelah data bertambah.
  getDataRange, // Ambil min-max waktu dari kumpulan candle.
} from "./chartPagination";

export {
  formatPrice as formatDisplayPrice, // Formatter harga umum untuk tampilan UI.
  formatVolume as formatDisplayVolume, // Formatter volume umum untuk tampilan UI.
  formatMarketCap, // Formatter market cap ke M/B/T.
} from "./formatters";

export {
  formatNumber as formatIndicatorNumber, // Formatter angka untuk data indikator.
  formatPrice as formatIndicatorPrice, // Formatter harga untuk data indikator.
  formatPercent, // Formatter persen (ROI, win rate, max drawdown).
  formatRatio, // Formatter rasio (Sharpe, Sortino).
  formatROI, // Formatter ROI 2 desimal.
  getIndicatorSignal, // Mapping sinyal ke label, warna, dan tipe ikon.
  safeSignal, // Validasi sinyal agar selalu buy/sell/neutral.
  countSignalsFromDB, // Hitung distribusi sinyal dari payload indikator.
  parseIndicators, // Parse indikator ke struktur ringkas per kategori.
  parseIndicatorsDetailed, // Parse indikator ke struktur detail per sub-komponen.
  calculateCategoryScore, // Hitung skor kategori berdasarkan bobot dan sinyal.
  getActiveCategoriesFromCombo, // Ambil kategori aktif dari string kombinasi.
  normalizeIndicatorName, // Rapikan nama indikator untuk tampilan tabel.
} from "./indicatorParser";

export {
  confirmLogout, // Dialog konfirmasi logout.
  confirmDelete, // Dialog konfirmasi hapus item.
  confirmAction, // Dialog konfirmasi generik.
  showSuccessToast, // Toast sukses.
  showErrorToast, // Toast error.
  showInfoToast, // Toast info.
  showWarningToast, // Toast peringatan.
} from "./notifications";
