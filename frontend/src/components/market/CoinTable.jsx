import { FiSearch, FiTrendingUp, FiTrendingDown } from "react-icons/fi";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import WatchlistStar from "./WatchlistStar";
import {
  formatPrice,
  formatVolume,
  formatMarketCap,
} from "../../utils/formatters";

export default function CoinTable({
  coins,
  isDarkMode,
  onClick,
  isWatched,
  toggleWatchlist,
}) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr
            className={`border-b ${
              isDarkMode
                ? "border-gray-700 bg-gray-900"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <th
              className={`text-left py-3 px-4 text-sm font-semibold ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Rank
            </th>
            <th
              className={`text-center py-3 px-2 text-sm font-semibold ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
              title="Watchlist"
            >
              Watchlist
            </th>
            <th
              className={`text-left py-3 px-4 text-sm font-semibold ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Name
            </th>
            <th
              className={`text-left py-3 px-4 text-sm font-semibold ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Symbol
            </th>
            <th
              className={`text-right py-3 px-4 text-sm font-semibold ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Price
            </th>
            <th
              className={`text-right py-3 px-4 text-sm font-semibold ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              24h %
            </th>
            <th
              className={`text-right py-3 px-4 text-sm font-semibold ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              24h Volume
            </th>
            <th
              className={`text-right py-3 px-4 text-sm font-semibold ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Market Cap
            </th>
            <th
              className={`text-center py-3 px-4 text-sm font-semibold ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Last 10 Candles
            </th>
          </tr>
        </thead>
        <tbody>
          {coins.length === 0 ? (
            <tr>
              <td
                colSpan="9"
                className={`py-12 text-center ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <FiSearch className="text-4xl" />
                  <span>No coins found matching your criteria</span>
                </div>
              </td>
            </tr>
          ) : (
            coins.map((coin, index) => {
              const positive = coin.change24h >= 0;
              const watched = isWatched(coin.coinId);
              const chartData = (coin.history || []).map((price, idx) => ({
                index: idx,
                price,
              }));

              return (
                <tr
                  key={coin.symbol}
                  className={`border-b transition-colors group cursor-pointer ${
                    watched
                      ? isDarkMode
                        ? "border-gray-700 bg-yellow-900/10 hover:bg-yellow-900/20"
                        : "border-gray-100 bg-yellow-50 hover:bg-yellow-100"
                      : isDarkMode
                      ? "border-gray-700 hover:bg-gray-700"
                      : "border-gray-100 hover:bg-blue-50"
                  }`}
                  onClick={() => onClick(coin.symbol)}
                >
                  <td className="py-4 px-4">
                    <span
                      className={`text-sm font-bold ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      #{index + 1}
                    </span>
                  </td>

                  <td className="py-4 px-2 text-center">
                    <WatchlistStar
                      coinId={coin.coinId}
                      isWatched={watched}
                      onToggle={toggleWatchlist}
                      isDarkMode={isDarkMode}
                    />
                  </td>

                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      {coin.logo ? (
                        <img
                          src={coin.logo}
                          alt={coin.name}
                          className="w-10 h-10 rounded-full object-cover shadow-md"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextElementSibling.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold shadow-md"
                        style={{ display: coin.logo ? "none" : "flex" }}
                      >
                        {coin.name.charAt(0)}
                      </div>
                      <div>
                        <div
                          className={`font-semibold transition-colors ${
                            isDarkMode
                              ? "text-white group-hover:text-blue-400"
                              : "text-gray-900 group-hover:text-blue-600"
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
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-medium ${
                        isDarkMode
                          ? "bg-gray-700 text-gray-300"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {coin.symbol}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div
                      className={`font-mono font-bold ${
                        isDarkMode ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {formatPrice(coin.price)}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold ${
                        positive
                          ? isDarkMode
                            ? "bg-green-900 text-green-300"
                            : "bg-green-100 text-green-700"
                          : isDarkMode
                          ? "bg-red-900 text-red-300"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {positive ? <FiTrendingUp /> : <FiTrendingDown />}
                      {positive ? "+" : ""}
                      {coin.change24h.toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div
                      className={`font-mono text-sm ${
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      {formatVolume(coin.volume * coin.price)}
                    </div>
                    <div
                      className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      {formatVolume(coin.volume)} {coin.symbol.split("-")[0]}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div
                      className={`font-mono font-semibold ${
                        isDarkMode ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {formatMarketCap(coin.marketCap)}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center justify-center">
                      {chartData.length > 0 ? (
                        (() => {
                          const prices = coin.history || [];
                          const min = Math.min(...prices);
                          const max = Math.max(...prices);
                          const delta = max - min;
                          const isFlat = delta === 0 || coin.change24h === 0;
                          const domainMin =
                            delta === 0 ? min - 0.5 : min - delta * 0.1;
                          const domainMax =
                            delta === 0 ? max + 0.5 : max + delta * 0.1;
                          const gradientId = `grad-${coin.symbol.replace(
                            /[^a-zA-Z0-9]/g,
                            ""
                          )}`;
                          const strokeColor = isFlat
                            ? isDarkMode
                              ? "#6b7280"
                              : "#9ca3af"
                            : coin.chartColor === "green"
                            ? "#22c55e"
                            : "#ef4444";

                          return (
                            <ResponsiveContainer width={120} height={60}>
                              <LineChart data={chartData}>
                                <defs>
                                  <linearGradient
                                    id={gradientId}
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                  >
                                    <stop
                                      offset="0%"
                                      stopColor={
                                        isFlat
                                          ? isDarkMode
                                            ? "#6b7280"
                                            : "#9ca3af"
                                          : coin.chartColor === "green"
                                          ? "#4ade80"
                                          : "#f87171"
                                      }
                                      stopOpacity={isFlat ? 0.4 : 0.8}
                                    />
                                    <stop
                                      offset="100%"
                                      stopColor={
                                        isFlat
                                          ? isDarkMode
                                            ? "#4b5563"
                                            : "#d1d5db"
                                          : coin.chartColor === "green"
                                          ? "#22c55e"
                                          : "#ef4444"
                                      }
                                      stopOpacity={0.05}
                                    />
                                  </linearGradient>
                                </defs>
                                <YAxis hide domain={[domainMin, domainMax]} />
                                <Tooltip
                                  content={({ active, payload }) => {
                                    if (active && payload && payload[0]) {
                                      return (
                                        <div
                                          className={`px-2 py-1 text-xs rounded shadow-lg ${
                                            isDarkMode
                                              ? "bg-gray-800 text-white border border-gray-700"
                                              : "bg-white text-gray-900 border border-gray-200"
                                          }`}
                                        >
                                          {formatPrice(payload[0].value)}
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="price"
                                  stroke={strokeColor}
                                  strokeWidth={isFlat ? 1.5 : 2}
                                  dot={false}
                                  isAnimationActive={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          );
                        })()
                      ) : (
                        <span
                          className={`text-xs ${
                            isDarkMode ? "text-gray-500" : "text-gray-400"
                          }`}
                        >
                          No data
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
