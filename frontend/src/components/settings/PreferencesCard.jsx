// PreferencesCard: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export function PreferencesCard({ isDarkMode, toggleDarkMode, t }) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 md:p-4 rounded-lg ${t(
        "bg-gray-700/50",
        "bg-gray-50"
      )}`}
    >
      <div>
        <div
          className={`font-medium text-sm md:text-base ${t(
            "text-white",
            "text-gray-900"
          )}`}
        >
          Dark Mode
        </div>
        <div
          className={`text-xs md:text-sm ${t(
            "text-gray-400",
            "text-gray-600"
          )}`}
        >
          Switch to dark theme
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer self-start sm:self-center">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={isDarkMode}
          onChange={toggleDarkMode}
        />
        <div
          className={`w-11 h-6 rounded-full peer peer-focus:outline-none peer-focus:ring-4 ${t(
            "bg-gray-600 peer-focus:ring-blue-800",
            "bg-gray-200 peer-focus:ring-blue-300"
          )} peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600`}
        />
      </label>
    </div>
  );
}

export default PreferencesCard;
