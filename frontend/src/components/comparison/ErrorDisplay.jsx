import { useDarkMode } from "../../contexts/DarkModeContext";
import { replaceIsoDatesInText } from "./utils";

// ErrorDisplay: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export function ErrorDisplay({ error, isLoading, isPending }) {
  const { isDarkMode } = useDarkMode();

  if (!error || isLoading || isPending) return null;

  const status = error?.response?.status;
  const payload = error?.response?.data || {};
  const apiMessage =
    typeof payload?.message === "string" && payload.message.trim()
      ? payload.message.trim()
      : null;
  const apiExample =
    typeof payload?.example === "string" && payload.example.trim()
      ? payload.example.trim()
      : null;

  const fallbackMessage =
    error?.message === "Network Error"
      ? "Tidak dapat terhubung ke server. Periksa koneksi internet atau backend Anda."
      : "Terjadi kendala saat memproses backtest. Silakan coba lagi.";

  const message = replaceIsoDatesInText(apiMessage || fallbackMessage);
  const exampleText = replaceIsoDatesInText(apiExample);

  const title =
    status === 400
      ? "Parameter Backtest Tidak Valid"
      : status === 401 || status === 403
        ? "Sesi Login Tidak Valid"
        : status === 404
          ? "Data Tidak Ditemukan"
          : status >= 500
            ? "Server Sedang Bermasalah"
            : "Backtest Gagal Dijalankan";

  const tips = [];
  if (status === 400) {
    tips.push("Periksa kembali rentang tanggal Start Date dan End Date.");
    tips.push(
      "Pastikan format tanggal valid dan tidak melewati batas data historis.",
    );
  }
  if (status === 404) {
    tips.push(
      "Coba ganti simbol atau rentang tanggal yang memiliki data candle.",
    );
  }
  if (!status || status >= 500) {
    tips.push(
      "Ulangi beberapa saat lagi atau cek log backend untuk detail error.",
    );
  }

  return (
    <div
      className={`relative overflow-hidden border rounded-xl md:rounded-2xl p-4 md:p-5 shadow-sm ${
        isDarkMode
          ? "bg-red-950/25 border-red-800/70"
          : "bg-red-50/80 border-red-200"
      }`}
    >
      <div
        className={`absolute left-0 top-0 h-full w-1 ${
          isDarkMode ? "bg-red-500/70" : "bg-red-500"
        }`}
      />

      <div
        className={`flex items-start justify-between gap-3 text-sm md:text-base mb-3 ${
          isDarkMode ? "text-red-300" : "text-red-700"
        }`}
      >
        <div className="flex items-start gap-2.5">
          <span className="text-lg md:text-xl leading-none">⚠️</span>
          <div>
            <p className="font-semibold leading-tight">{title}</p>
            <p
              className={`text-[11px] md:text-xs mt-1 ${
                isDarkMode ? "text-red-400" : "text-red-600"
              }`}
            >
              Mohon perbaiki input berikut sebelum menjalankan backtest.
            </p>
          </div>
        </div>
      </div>

      <div
        className={`rounded-lg px-3 py-2.5 ${
          isDarkMode ? "bg-red-950/35" : "bg-white/90"
        }`}
      >
        <p
          className={`text-[11px] uppercase tracking-wide font-semibold mb-1 ${
            isDarkMode ? "text-red-400" : "text-red-600"
          }`}
        >
          Pesan
        </p>
        <p
          className={`text-sm md:text-base leading-relaxed ${
            isDarkMode ? "text-red-100" : "text-red-900"
          }`}
        >
          {message}
        </p>
      </div>

      {exampleText && (
        <div
          className={`mt-2 text-xs md:text-sm rounded-lg px-3 py-2.5 ${
            isDarkMode
              ? "bg-red-950/25 text-red-200"
              : "bg-white/80 text-red-800"
          }`}
        >
          <p
            className={`text-[11px] uppercase tracking-wide font-semibold mb-1 ${
              isDarkMode ? "text-red-400" : "text-red-600"
            }`}
          >
            Contoh Input
          </p>
          <p>{exampleText}</p>
        </div>
      )}

      {tips.length > 0 && (
        <div className="mt-3">
          <p
            className={`text-[11px] uppercase tracking-wide font-semibold mb-1.5 ${
              isDarkMode ? "text-red-400" : "text-red-600"
            }`}
          >
            Saran Perbaikan
          </p>
          <ul
            className={`space-y-1.5 text-xs md:text-sm ${
              isDarkMode ? "text-red-200" : "text-red-700"
            }`}
          >
            {tips.map((tip) => (
              <li key={tip} className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
