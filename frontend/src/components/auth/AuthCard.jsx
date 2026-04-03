import { useDarkMode } from "../../contexts/DarkModeContext";

// AuthCard: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export function AuthCard({ children }) {
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

export default AuthCard;
