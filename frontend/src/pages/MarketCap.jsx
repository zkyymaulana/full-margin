import { useMarketCapLive } from "../hooks/useMarketcap";
import { useWatchlist } from "../hooks/useWatchlist";
import { useState } from "react";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useSymbol } from "../contexts/SymbolContext";
import { useNavigate } from "react-router-dom";
import {
  MarketStatsCards,
  MarketFilters,
  MarketCapHeader,
  MarketCoinsSection,
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
      <MarketCapHeader
        isDarkMode={isDarkMode}
        onRefresh={() => {
          refetch();
          refetchWatchlist();
        }}
      />

      <MarketStatsCards summary={summary} timestamp={timestamp} />

      <MarketFilters
        filter={filter}
        setFilter={handleFilterChange}
        searchQuery={searchQuery}
        setSearchQuery={handleSearchChange}
        isDarkMode={isDarkMode}
      />

      <MarketCoinsSection
        isDarkMode={isDarkMode}
        displayedCoins={displayedCoins}
        filteredCoins={filteredCoins}
        allCoins={allCoins}
        showLoadMore={showLoadMore}
        onLoadMore={handleLoadMore}
        onCoinClick={handleCoinClick}
        isWatched={isWatched}
        toggleWatchlist={toggleWatchlist}
      />
    </div>
  );
}

export { MarketCapPage };
export default MarketCapPage;
