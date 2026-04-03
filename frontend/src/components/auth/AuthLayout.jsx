import { useDarkMode } from "../../contexts/DarkModeContext";
import { HiMoon, HiSun } from "react-icons/hi";

// AuthLayout: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export function AuthLayout({ children }) {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <div
      className={`min-h-screen ${
        isDarkMode
          ? "bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900"
          : "bg-gradient-to-br from-blue-500 to-purple-600"
      } flex items-center justify-center p-4 transition-colors duration-300`}
    >
      <button
        onClick={toggleDarkMode}
        className={`fixed top-4 right-4 p-3 rounded-full shadow-lg transition-all duration-300 hover:cursor-pointer ${
          isDarkMode
            ? "bg-gray-800 text-yellow-400 hover:bg-gray-700"
            : "bg-white text-gray-800 hover:bg-gray-100"
        }`}
        aria-label="Toggle dark mode"
      >
        {isDarkMode ? (
          <HiSun className="w-6 h-6" />
        ) : (
          <HiMoon className="w-6 h-6" />
        )}
      </button>

      {children}
    </div>
  );
}

export default AuthLayout;
