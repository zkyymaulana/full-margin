import { FiSearch, FiTrendingDown, FiTrendingUp } from "react-icons/fi";
import CoinCard from "./CoinCard";
import CoinTable from "./CoinTable";

function MarketCoinsSection({
  isDarkMode,
  displayedCoins,
  filteredCoins,
  allCoins,
  showLoadMore,
  onLoadMore,
  onCoinClick,
  isWatched,
  toggleWatchlist,
}) {
  return (
    <div
      className={`rounded-lg md:rounded-xl shadow-sm border ${
        isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      <div
        className={`p-4 md:p-6 border-b flex items-center justify-between ${
          isDarkMode ? "border-gray-700" : "border-gray-200"
        }`}
      >
        <div className="flex items-center gap-2 md:gap-3">
          <FiTrendingUp className="text-lg md:text-2xl" />
          <h3
            className={`text-base md:text-xl font-semibold ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            Top Cryptocurrencies
          </h3>
        </div>

        <span
          className={`px-2 md:px-3 py-1 text-[10px] md:text-xs font-medium rounded-full ${
            isDarkMode
              ? "bg-blue-900 text-blue-300"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          Live Data
        </span>
      </div>

      <div className="md:hidden">
        {displayedCoins.length === 0 ? (
          <div
            className={`py-12 text-center ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <FiSearch className="text-4xl" />
              <span className="text-sm">
                No coins found matching your criteria
              </span>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-300">
            {displayedCoins.map((coin) => (
              <CoinCard
                key={coin.symbol}
                coin={coin}
                index={filteredCoins.indexOf(coin)}
                isDarkMode={isDarkMode}
                onClick={onCoinClick}
                isWatched={isWatched(coin.coinId)}
                toggleWatchlist={toggleWatchlist}
              />
            ))}
          </div>
        )}
      </div>

      <CoinTable
        coins={displayedCoins}
        isDarkMode={isDarkMode}
        onClick={onCoinClick}
        isWatched={isWatched}
        toggleWatchlist={toggleWatchlist}
      />

      {showLoadMore && (
        <div className="p-3 md:p-4 flex justify-center text-sm">
          <button
            onClick={onLoadMore}
            className={`hover:cursor-pointer px-4 md:px-6 py-2 md:py-3 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 text-sm md:text-base ${
              isDarkMode
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-blue-400 hover:bg-blue-500 text-white"
            } shadow-lg `}
          >
            <FiTrendingDown className="text-base md:text-lg" />
            Load More Coins
          </button>
        </div>
      )}

      <div
        className={`p-3 md:p-4 border-t flex items-center justify-between text-xs md:text-sm ${
          isDarkMode ? "border-gray-700" : "border-gray-200"
        }`}
      >
        <div className={`${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
          Showing {displayedCoins.length} of {filteredCoins.length} coins
          {filteredCoins.length !== allCoins.length && (
            <span className="ml-1 hidden sm:inline">
              (filtered from {allCoins.length} total)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export { MarketCoinsSection };
export default MarketCoinsSection;
