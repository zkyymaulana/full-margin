import { useDarkMode } from "../../contexts/DarkModeContext";

export default function AuthHeader({ title, subtitle }) {
  const { isDarkMode } = useDarkMode();

  return (
    <div className="flex justify-center items-center mb-8 space-x-1">
      <div
        className={`inline-flex w-16 h-16 bg-#D7BCFF rounded-full items-center`}
      >
        <img src="/images/logo.svg" alt="Logo" className="w-14 h-14" />
      </div>
      <div>
        <h1
          className={`text-3xl font-bold ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          {title}
        </h1>
        <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}
