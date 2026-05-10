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
      ? "Unable to reach the server. Check your internet connection or backend."
      : "We ran into an issue while running the backtest. Please try again.";

  const message = replaceIsoDatesInText(apiMessage || fallbackMessage);
  const exampleText = replaceIsoDatesInText(apiExample);

  const title =
    status === 400
      ? "Invalid Backtest Parameters"
      : status === 401 || status === 403
        ? "Session Not Valid"
        : status === 404
          ? "Data Not Found"
          : status >= 500
            ? "Server Issue"
            : "Backtest Failed";

  const tips = [];
  if (status === 400) {
    tips.push("Double-check the Start Date and End Date range.");
    tips.push("Ensure the date format is valid and within the dataset range.");
  }
  if (status === 404) {
    tips.push("Try another symbol or a date range with available candles.");
  }
  if (!status || status >= 500) {
    tips.push("Try again in a moment or check backend logs for details.");
  }

  return (
    <div
      className={`relative overflow-hidden border rounded-xl md:rounded-2xl p-4 md:p-5 shadow-sm ${
        isDarkMode
          ? "bg-slate-900/40 border-sky-800/60"
          : "bg-sky-50/80 border-sky-200"
      }`}
    >
      <div
        className={`absolute left-0 top-0 h-full w-1 ${
          isDarkMode ? "bg-sky-500/70" : "bg-sky-500"
        }`}
      />

      <div
        className={`flex items-start justify-between gap-3 text-sm md:text-base mb-3 ${
          isDarkMode ? "text-sky-200" : "text-sky-800"
        }`}
      >
        <div className="flex items-start gap-2.5">
          <span className="text-lg md:text-xl leading-none">ℹ️</span>
          <div>
            <p className="font-semibold leading-tight">{title}</p>
            <p
              className={`text-[11px] md:text-xs mt-1 ${
                isDarkMode ? "text-sky-300" : "text-sky-700"
              }`}
            >
              Please review the details below before running the backtest.
            </p>
          </div>
        </div>
      </div>

      <div
        className={`rounded-lg px-3 py-2.5 ${
          isDarkMode ? "bg-slate-950/30" : "bg-white/90"
        }`}
      >
        <p
          className={`text-[11px] uppercase tracking-wide font-semibold mb-1 ${
            isDarkMode ? "text-sky-300" : "text-sky-700"
          }`}
        >
          Message
        </p>
        <p
          className={`text-sm md:text-base leading-relaxed ${
            isDarkMode ? "text-slate-100" : "text-slate-900"
          }`}
        >
          {message}
        </p>
      </div>

      {exampleText && (
        <div
          className={`mt-2 text-xs md:text-sm rounded-lg px-3 py-2.5 ${
            isDarkMode
              ? "bg-slate-950/25 text-slate-200"
              : "bg-white/80 text-slate-800"
          }`}
        >
          <p
            className={`text-[11px] uppercase tracking-wide font-semibold mb-1 ${
              isDarkMode ? "text-sky-300" : "text-sky-700"
            }`}
          >
            Example
          </p>
          <p>{exampleText}</p>
        </div>
      )}

      {tips.length > 0 && (
        <div className="mt-3">
          <p
            className={`text-[11px] uppercase tracking-wide font-semibold mb-1.5 ${
              isDarkMode ? "text-sky-300" : "text-sky-700"
            }`}
          >
            Suggestions
          </p>
          <ul
            className={`space-y-1.5 text-xs md:text-sm ${
              isDarkMode ? "text-slate-200" : "text-slate-700"
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
