import { useDarkMode } from "../contexts/DarkModeContext";

function Footer() {
  const { isDarkMode } = useDarkMode();

  return (
    <footer
      className={`py-4 px-6 border-t ${
        isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
      }`}
    >
      <div
        className={`text-center text-sm ${
          isDarkMode ? "text-gray-400" : "text-gray-600"
        }`}
      >
        © {new Date().getFullYear()} Crypto Analyze Admin. All rights reserved.
      </div>
    </footer>
  );
}

export default Footer;
