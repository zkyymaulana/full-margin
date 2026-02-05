import { Link } from "react-router-dom";
import { useDarkMode } from "../../contexts/DarkModeContext";
import { formatPrice } from "../../utils/chartConfig";
import { FaCoins } from "react-icons/fa6";

/**
 * Top Coins Section Component
 * Displays top 5 cryptocurrencies with live prices
 */
function TopCoinsSection({ topCoins }) {
  const { isDarkMode } = useDarkMode();

  if (!topCoins || topCoins.length === 0) return null;

  return (
    <div className="card">
      <div className={`card-body ${isDarkMode ? "bg-gray-800" : "bg-white"}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
              <FaCoins className="text-lg text-white" />
            </div>
            <div>
              <h4
                className={`text-lg font-semibold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                Top 5 Cryptocurrencies
              </h4>
              <p
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                Live market data
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span
              className={`text-xs ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {topCoins.map((coin, index) => {
            const change = coin.open
              ? ((coin.price - coin.open) / coin.open) * 100
              : 0;
            const isPositive = change >= 0;

            return (
              <div
                key={coin.symbol}
                className={`p-4 rounded-lg shadow-sm border hover:shadow-md transition-all duration-200 hover:scale-105 ${
                  isDarkMode
                    ? "bg-gray-900 border-gray-700"
                    : "bg-white border-gray-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                      isDarkMode ? "bg-gray-700" : "bg-gray-200"
                    }`}
                  >
                    {coin.rank}
                  </div>
                  {/* ✅ Use logo from API instead of gradient initial */}
                  {coin.logo ? (
                    <img
                      src={coin.logo}
                      alt={coin.name}
                      className="w-8 h-8 rounded-full object-cover shadow-md"
                      onError={(e) => {
                        // Fallback to gradient initial if image fails to load
                        e.target.style.display = "none";
                        e.target.nextElementSibling.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <div
                    className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm"
                    style={{ display: coin.logo ? "none" : "flex" }}
                  >
                    {coin.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`font-semibold text-sm truncate ${
                        isDarkMode ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {coin.name}
                    </div>
                    <div
                      className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      {coin.symbol}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div
                    className={`font-mono text-lg font-bold ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {formatPrice(coin.price)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      24h:
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        isPositive
                          ? isDarkMode
                            ? "bg-green-900 text-green-300"
                            : "bg-green-100 text-green-600"
                          : isDarkMode
                          ? "bg-red-900 text-red-300"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {change.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-center">
          <Link
            to="/marketcap"
            className={`inline-block px-4 py-2 text-sm font-medium rounded-lg shadow transition-colors ${
              isDarkMode
                ? "bg-blue-900 text-blue-300 hover:bg-blue-800"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            View All Markets
          </Link>
        </div>
      </div>
    </div>
  );
}

export default TopCoinsSection;
