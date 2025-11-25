import { useMarketCapLive } from "../hooks/useMarketcap";
import { useState } from "react";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useSymbol } from "../contexts/SymbolContext";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";

function MarketCap() {
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [limit, setLimit] = useState(5);

  const { data, isLoading, error, refetch } = useMarketCapLive(limit);
  const { isDarkMode } = useDarkMode();
  const { setSelectedSymbol } = useSymbol();
  const navigate = useNavigate();

  // Handler untuk navigasi ke dashboard dengan symbol yang dipilih
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

  const coins = data?.data || [];
  const summary = data?.summary || {
    totalMarketCap: 0,
    totalVolume24h: 0,
    btcDominance: 0,
    activeCoins: 0,
    gainers: 0,
    losers: 0,
  };
  const timestamp = data?.timestamp || new Date().toISOString();

  // Filter coins
  const filteredCoins = coins.filter((coin) => {
    const matchesSearch =
      coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coin.symbol.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === "all") return true;
    if (filter === "gainers") return coin.change24h > 0;
    if (filter === "losers") return coin.change24h < 0;

    return true;
  });

  const formatPrice = (price) => {
    if (price >= 1000)
      return `$${price.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    if (price >= 0.0001) return `$${price.toFixed(6)}`;
    if (price > 0) return `$${price.toFixed(10)}`;
    return `$${price.toFixed(8)}`;
  };

  const formatVolume = (vol) => {
    if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
    if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
    if (vol >= 1e3) return `$${(vol / 1e3).toFixed(2)}K`;
    return `$${vol.toFixed(2)}`;
  };

  const formatMarketCap = (vol) => {
    if (vol >= 1e12) return `$${(vol / 1e12).toFixed(2)}T`;
    if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
    if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
    return `$${vol.toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className={`text-3xl font-bold flex items-center gap-3 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            <span>🪙</span>
            Market Cap Overview
          </h1>
          <p
            className={`mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}
          >
            Top cryptocurrencies ranked by market capitalization
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <span>🔄</span>
          Refresh Data
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Total Market Cap</div>
            <div className="text-2xl">💰</div>
          </div>
          <div className="text-3xl font-bold">
            {formatMarketCap(summary.totalMarketCap)}
          </div>
          <div className="text-xs opacity-75 mt-1">
            Updated: {new Date(timestamp).toLocaleTimeString()}
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">24h Volume</div>
            <div className="text-2xl">📊</div>
          </div>
          <div className="text-3xl font-bold">
            {formatMarketCap(summary.totalVolume24h)}
          </div>
          <div className="text-xs opacity-75 mt-1">Live from Coinbase</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">BTC Dominance</div>
            <div className="text-2xl">₿</div>
          </div>
          <div className="text-3xl font-bold">{summary.btcDominance}%</div>
          <div className="text-xs opacity-75 mt-1">
            Gainers: {summary.gainers} • Losers: {summary.losers}
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Active Coins</div>
            <div className="text-2xl">🎯</div>
          </div>
          <div className="text-3xl font-bold">{summary.activeCoins}</div>
          <div className="text-xs opacity-75 mt-1">
            <div className="w-2 h-2 bg-white rounded-full inline-block animate-pulse mr-1"></div>
            Live Data
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div
        className={`rounded-xl shadow-sm border p-4 ${
          isDarkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-200"
        }`}
      >
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex gap-2">
            <span
              className={`text-sm self-center font-medium ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Market Filters
            </span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                isDarkMode
                  ? "border-gray-600 bg-gray-700 text-white"
                  : "border-gray-300 bg-white text-gray-900"
              }`}
            >
              <option value="all">All Market Caps</option>
              <option value="gainers">Gainers Only</option>
              <option value="losers">Losers Only</option>
            </select>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                isDarkMode
                  ? "border-gray-600 bg-gray-700 text-white"
                  : "border-gray-300 bg-white text-gray-900"
              }`}
            >
              <option value="5">Show 5</option>
              <option value="10">Show 10</option>
              <option value="20">Show 20</option>
            </select>
          </div>

          <div className="relative w-full md:w-auto">
            <input
              type="text"
              placeholder="Search coins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full md:w-64 px-4 py-2 pl-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                isDarkMode
                  ? "border-gray-600 bg-gray-700 text-white placeholder-gray-500"
                  : "border-gray-300 bg-white text-gray-900 placeholder-gray-400"
              }`}
            />
            <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
          </div>
        </div>
      </div>

      {/* Market Cap Table */}
      <div
        className={`rounded-xl shadow-sm border ${
          isDarkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-200"
        }`}
      >
        <div
          className={`p-6 border-b flex items-center justify-between ${
            isDarkMode ? "border-gray-700" : "border-gray-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="text-2xl">🌟</div>
            <h3
              className={`text-xl font-semibold ${
                isDarkMode ? "text-white" : "text-gray-900"
              }`}
            >
              Top Cryptocurrencies
            </h3>
          </div>
          <span
            className={`px-3 py-1 text-xs font-medium rounded-full ${
              isDarkMode
                ? "bg-blue-900 text-blue-300"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            Live Data
          </span>
        </div>

        <div className="overflow-x-auto">
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
              {filteredCoins.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className={`py-12 text-center ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl">🔍</span>
                      <span>No coins found matching your criteria</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCoins.map((coin) => {
                  const isPositive = coin.change24h >= 0;

                  // Transform history array to chart data format
                  const chartData = (coin.history || []).map(
                    (price, index) => ({
                      index,
                      price,
                    })
                  );

                  return (
                    <tr
                      key={coin.symbol}
                      className={`border-b transition-colors group ${
                        isDarkMode
                          ? "border-gray-700 hover:bg-gray-700"
                          : "border-gray-100 hover:bg-blue-50"
                      }`}
                      onClick={() => handleCoinClick(coin.symbol)}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-bold ${
                              isDarkMode ? "text-gray-400" : "text-gray-500"
                            }`}
                          >
                            #{filteredCoins.indexOf(coin) + 1}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          {/* ✅ Use logo from API instead of gradient initial */}
                          {coin.logo ? (
                            <img
                              src={coin.logo}
                              alt={coin.name}
                              className="w-10 h-10 rounded-full object-cover shadow-md"
                              onError={(e) => {
                                // Fallback to gradient initial if image fails to load
                                e.target.style.display = "none";
                                e.target.nextElementSibling.style.display =
                                  "flex";
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
                        <div className="flex items-center justify-end gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold ${
                              isPositive
                                ? isDarkMode
                                  ? "bg-green-900 text-green-300"
                                  : "bg-green-100 text-green-700"
                                : isDarkMode
                                ? "bg-red-900 text-red-300"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            <span>{isPositive ? "↗" : "↘"}</span>
                            {isPositive ? "+" : ""}
                            {coin.change24h.toFixed(2)}%
                          </span>
                        </div>
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
                          {formatVolume(coin.volume)}{" "}
                          {coin.symbol.split("-")[0]}
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
                              // Calculate min, max, and delta for adaptive domain
                              const prices = coin.history || [];
                              const min = Math.min(...prices);
                              const max = Math.max(...prices);
                              const delta = max - min;

                              // Determine if the chart is flat (stablecoin or no movement)
                              const isFlat =
                                delta === 0 || coin.change24h === 0;

                              // Adaptive domain calculation
                              const domainMin =
                                delta === 0 ? min - 0.5 : min - delta * 0.1;
                              const domainMax =
                                delta === 0 ? max + 0.5 : max + delta * 0.1;

                              // Clean gradient ID (remove special characters)
                              const gradientId = `grad-${coin.symbol.replace(
                                /[^a-zA-Z0-9]/g,
                                ""
                              )}`;

                              // Determine stroke color
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
                                    <YAxis
                                      hide
                                      domain={[domainMin, domainMax]}
                                    />
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

        {/* Pagination */}
        <div
          className={`p-4 border-t flex items-center justify-between ${
            isDarkMode ? "border-gray-700" : "border-gray-200"
          }`}
        >
          <div
            className={`text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Showing {filteredCoins.length} of {coins.length} coins (Limit:{" "}
            {limit})
          </div>
          {/* <div className="flex gap-2">
            <button
              className={`px-4 py-2 border rounded-lg transition-colors text-sm font-medium ${
                isDarkMode
                  ? "border-gray-600 hover:bg-gray-700 text-gray-300"
                  : "border-gray-300 hover:bg-gray-50 text-gray-700"
              }`}
            >
              Previous
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              Next
            </button>
          </div> */}
        </div>
      </div>
    </div>
  );
}

export default MarketCap;
