import { useDarkMode } from "../../contexts/DarkModeContext";

// ErrorDisplay: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export function ErrorDisplay({ error, isLoading, isPending }) {
  const { isDarkMode } = useDarkMode();

  if (!error || isLoading || isPending) return null;

  return (
    <div
      className={`border rounded-lg md:rounded-xl p-3 md:p-4 ${
        isDarkMode ? "bg-red-900/20 border-red-800" : "bg-red-50 border-red-200"
      }`}
    >
      <div
        className={`flex items-center gap-2 text-sm md:text-base ${
          isDarkMode ? "text-red-400" : "text-red-700"
        }`}
      >
        <span className="text-lg md:text-xl">⚠️</span>
        <span className="font-medium">Error: {error.message}</span>
      </div>
    </div>
  );
}
