import { useDarkMode } from "../../contexts/DarkModeContext";

export default function AuthDivider({ text }) {
  const { isDarkMode } = useDarkMode();

  return (
    <div className="relative my-6">
      <div
        className={`absolute inset-0 flex items-center ${
          isDarkMode ? "text-gray-600" : "text-gray-300"
        }`}
      >
        <div className="w-full border-t"></div>
      </div>
      <div className="relative flex justify-center text-sm">
        <span
          className={`px-2 ${
            isDarkMode ? "bg-gray-800 text-gray-400" : "bg-white text-gray-500"
          }`}
        >
          {text}
        </span>
      </div>
    </div>
  );
}
