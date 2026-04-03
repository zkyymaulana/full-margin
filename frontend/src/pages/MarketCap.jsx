import { useMarketCapLive } from "../hooks/useMarketcap";
import { useWatchlist } from "../hooks/useWatchlist";
import { useState } from "react";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useSymbol } from "../contexts/SymbolContext";
import { useNavigate } from "react-router-dom";
import {
  FiDollarSign,
  FiSearch,
  FiTrendingUp,
  FiTrendingDown,
} from "react-icons/fi";
import {
  MarketStatsCards,
  MarketFilters,
  CoinCard,
  CoinTable,
} from "../components/market";

// Halaman market cap: menampilkan statistik market dan daftar coin interaktif.
function MarketCapPage() {
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);

  const { data, isLoading, error, refetch } = useMarketCapLive();
  const { isDarkMode } = useDarkMode();
  const { setSelectedSymbol } = useSymbol();
  const navigate = useNavigate();

  const {
    isWatched,
    toggleWatchlist,
    refetch: refetchWatchlist,
  } = useWatchlist();

  // Pilih coin lalu arahkan user ke dashboard dengan simbol terpilih.
  const handleCoinClick = (symbol) => {
    console.log("🎯 Coin selected:", symbol);
    setSelectedSymbol(symbol);

    const toast = document.createElement("div");
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-semibold z-50 animate-bounce ${
      isDarkMode ? "bg-blue-600" : "bg-blue-500"
    }`;
    toast.innerHTML = `✅ Selected: ${symbol.replace("-USD", "")}`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
      navigate("/dashboard");
    }, 800);
  };

  // Tampilkan seluruh coin yang sudah lolos filter.
  const handleLoadMore = () => {
    setVisibleCount(allCoins.length);
  };

  // Reset jumlah item saat filter/search berubah.
  const resetVisibleCount = () => {
    setVisibleCount(10);
  };

  // Update filter market aktif.
  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    resetVisibleCount();
  };

  // Update keyword pencarian coin.
  const handleSearchChange = (query) => {
    setSearchQuery(query);
    resetVisibleCount();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div className={isDarkMode ? "text-gray-400" : "text-gray-500"}>
            Loading market data...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`p-4 border rounded-lg ${
          isDarkMode
            ? "bg-red-900 border-red-600 text-red-300"
            : "bg-red-100 border-red-400 text-red-700"
        }`}
      >
        Error loading market cap data: {error.message}
      </div>
    );
  }

  const allCoins = data?.data || [];
  const summary = data?.summary || {
    totalMarketCap: 0,
    totalVolume24h: 0,
    btcDominance: 0,
    activeCoins: 0,
    gainers: 0,
    losers: 0,
  };
  const timestamp = data?.timestamp || new Date().toISOString();

  // Terapkan filter + search ke daftar coin.
  const filteredCoins = allCoins.filter((coin) => {
    const matchesSearch =
      coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coin.symbol.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === "all") return true;
    if (filter === "gainers") return coin.change24h > 0;
    if (filter === "losers") return coin.change24h < 0;

    return true;
  });

  // Tentukan data yang benar-benar ditampilkan ke UI.
  const displayedCoins = filteredCoins.slice(0, visibleCount);
  const showLoadMore = visibleCount < filteredCoins.length;

  return (
    <div className="space-y-4 md:space-y-6 px-2 md:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1
            className={`text-2xl md:text-3xl font-bold flex items-center gap-2 md:gap-3 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            <FiDollarSign className="text-xl md:text-2xl" />
            Market Cap Overview
          </h1>
          <p
            className={`mt-1 text-sm md:text-base ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Top cryptocurrencies ranked by market capitalization
          </p>
        </div>
        <button
          onClick={() => {
            refetch();
            refetchWatchlist();
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 text-sm ${
            isDarkMode
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          } shadow-md hover:shadow-lg`}
        >
          🔄 Refresh Data
        </button>
      </div>

      <MarketStatsCards summary={summary} timestamp={timestamp} />

      <MarketFilters
        filter={filter}
        setFilter={handleFilterChange}
        searchQuery={searchQuery}
        setSearchQuery={handleSearchChange}
        isDarkMode={isDarkMode}
      />

      {/* Market Cap Cards for Mobile, Table for Desktop */}
      <div
        className={`rounded-lg md:rounded-xl shadow-sm border ${
          isDarkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-200"
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

        {/* Mobile Card View */}
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
              {displayedCoins.map((coin, index) => (
                <CoinCard
                  key={coin.symbol}
                  coin={coin}
                  index={filteredCoins.indexOf(coin)}
                  isDarkMode={isDarkMode}
                  onClick={handleCoinClick}
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
          onClick={handleCoinClick}
          isWatched={isWatched}
          toggleWatchlist={toggleWatchlist}
        />

        {showLoadMore && (
          <div className="p-3 md:p-4 flex justify-center text-sm">
            <button
              onClick={handleLoadMore}
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
    </div>
  );
}

export { MarketCapPage };
export default MarketCapPage;
