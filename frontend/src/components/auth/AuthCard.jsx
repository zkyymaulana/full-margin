import { useDarkMode } from "../../contexts/DarkModeContext";

export default function AuthCard({ children }) {
  const { isDarkMode } = useDarkMode();

  return (
    <div
      className={`${
        isDarkMode ? "bg-gray-800" : "bg-white"
      } rounded-lg shadow-xl p-8 w-full max-w-md transition-colors duration-300`}
    >
      {children}
    </div>
  );
}
