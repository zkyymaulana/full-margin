import { useDarkMode } from "../../contexts/DarkModeContext";

function DashboardHeader() {
  const { isDarkMode } = useDarkMode();

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1
          className={`text-3xl font-bold ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          Dashboard
        </h1>
        <p className={`mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
          Cryptocurrency market analysis
        </p>
      </div>
    </div>
  );
}

export { DashboardHeader };
export default DashboardHeader;
