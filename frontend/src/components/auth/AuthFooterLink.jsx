import { Link } from "react-router-dom";
import { useDarkMode } from "../../contexts/DarkModeContext";

export default function AuthFooterLink({ text, linkText, to }) {
  const { isDarkMode } = useDarkMode();

  return (
    <div className="mt-6 text-center">
      <p
        className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}
      >
        {text}{" "}
        <Link
          to={to}
          className={`font-medium ${
            isDarkMode
              ? "text-blue-400 hover:text-blue-300"
              : "text-blue-600 hover:text-blue-700"
          }`}
        >
          {linkText}
        </Link>
      </p>
    </div>
  );
}
