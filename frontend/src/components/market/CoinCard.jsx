import { FiTrendingUp, FiTrendingDown } from "react-icons/fi";
import WatchlistStar from "./WatchlistStar";
import { formatPrice, formatMarketCap } from "../../utils/formatters";

export default function CoinCard({
  coin,
  index,
  isDarkMode,
  onClick,
  isWatched,
  toggleWatchlist,
}) {
  const isPositive = coin.change24h >= 0;

  return (
    <div
      onClick={() => onClick(coin.symbol)}
      className={`p-4 transition-colors cursor-pointer ${
        isWatched
          ? isDarkMode
            ? "bg-yellow-900/10 hover:bg-yellow-900/20"
            : "bg-yellow-50 hover:bg-yellow-100"
          : isDarkMode
          ? "hover:bg-gray-700"
          : "hover:bg-blue-50"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-bold ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            #{index + 1}
          </span>
          {coin.logo ? (
            <img
              src={coin.logo}
              alt={coin.name}
              className="w-8 h-8 rounded-full object-cover shadow-md"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextElementSibling.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold shadow-md text-xs"
            style={{ display: coin.logo ? "none" : "flex" }}
          >
            {coin.name.charAt(0)}
          </div>
          <div>
            <div
              className={`font-semibold text-sm ${
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
        <div className="flex items-center gap-2">
          <WatchlistStar
            coinId={coin.coinId}
            isWatched={isWatched}
            onToggle={toggleWatchlist}
            isDarkMode={isDarkMode}
          />
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold ${
              isPositive
                ? isDarkMode
                  ? "bg-green-900 text-green-300"
                  : "bg-green-100 text-green-700"
                : isDarkMode
                ? "bg-red-900 text-red-300"
                : "bg-red-100 text-red-700"
            }`}
          >
            {isPositive ? <FiTrendingUp /> : <FiTrendingDown />}
            {isPositive ? "+" : ""}
            {coin.change24h.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div
            className={`text-xs ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            Price
          </div>
          <div
            className={`font-mono font-bold text-sm ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            {formatPrice(coin.price)}
          </div>
        </div>
        <div>
          <div
            className={`text-xs ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            Market Cap
          </div>
          <div
            className={`font-mono font-semibold text-sm ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            {formatMarketCap(coin.marketCap)}
          </div>
        </div>
      </div>
    </div>
  );
}
