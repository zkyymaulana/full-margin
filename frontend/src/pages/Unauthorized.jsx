import { useNavigate } from "react-router-dom";
import { useDarkMode } from "../contexts/DarkModeContext";

/**
 * Unauthorized Page
 * =================
 * Halaman yang ditampilkan ketika user mencoba akses route admin
 * tapi tidak memiliki permission yang cukup
 */
function Unauthorized() {
  const navigate = useNavigate();
  const { isDarkMode } = useDarkMode();

  return (
    <div
      className={`min-h-screen flex items-center justify-center ${
        isDarkMode ? "bg-gray-900" : "bg-gray-50"
      }`}
    >
      <div className="max-w-md w-full px-6">
        <div
          className={`rounded-2xl shadow-2xl p-8 text-center ${
            isDarkMode ? "bg-gray-800" : "bg-white"
          }`}
        >
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1
            className={`text-3xl font-bold mb-4 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            Access Denied
          </h1>

          {/* Message */}
          <p
            className={`text-lg mb-6 ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            You don't have permission to access this page.
          </p>

          <div
            className={`p-4 rounded-lg mb-6 ${
              isDarkMode
                ? "bg-red-900/20 border border-red-800"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <p
              className={`text-sm ${
                isDarkMode ? "text-red-300" : "text-red-700"
              }`}
            >
              ⛔ This page is restricted to administrators only.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => navigate(-1)}
              className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
                isDarkMode
                  ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-700"
              }`}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Unauthorized;
