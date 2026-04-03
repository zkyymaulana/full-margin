import { FiDollarSign, FiBarChart2, FiTarget } from "react-icons/fi";
import { SiBitcoin } from "react-icons/si";
import { formatMarketCap } from "../../utils/formatters";

// MarketStatsCards: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export function MarketStatsCards({ summary, timestamp }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg md:rounded-xl shadow-lg p-4 md:p-6 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs md:text-sm opacity-90">Total Market Cap</div>
          <FiDollarSign className="text-lg md:text-2xl" />
        </div>
        <div className="text-xl md:text-3xl font-bold">
          {formatMarketCap(summary.totalMarketCap)}
        </div>
        <div className="text-[10px] md:text-xs opacity-75 mt-1 hidden md:block">
          Updated: {new Date(timestamp).toLocaleTimeString()}
        </div>
      </div>

      <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg md:rounded-xl shadow-lg p-4 md:p-6 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs md:text-sm opacity-90">24h Volume</div>
          <FiBarChart2 className="text-lg md:text-2xl" />
        </div>
        <div className="text-xl md:text-3xl font-bold">
          {formatMarketCap(summary.totalVolume24h)}
        </div>
        <div className="text-[10px] md:text-xs opacity-75 mt-1 hidden md:block">
          Live from Coinbase
        </div>
      </div>

      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg md:rounded-xl shadow-lg p-4 md:p-6 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs md:text-sm opacity-90">BTC Dominance</div>
          <SiBitcoin className="text-lg md:text-2xl" />
        </div>
        <div className="text-xl md:text-3xl font-bold">
          {summary.btcDominance}%
        </div>
        <div className="text-[10px] md:text-xs opacity-75 mt-1">
          <span className="hidden md:inline">
            Gainers: {summary.gainers} • Losers: {summary.losers}
          </span>
          <span className="md:hidden">
            {summary.gainers}↑ • {summary.losers}↓
          </span>
        </div>
      </div>

      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg md:rounded-xl shadow-lg p-4 md:p-6 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs md:text-sm opacity-90">Active Coins</div>
          <FiTarget className="text-lg md:text-2xl" />
        </div>
        <div className="text-xl md:text-3xl font-bold">
          {summary.activeCoins}
        </div>
        <div className="text-[10px] md:text-xs opacity-75 mt-1">
          <div className="w-2 h-2 bg-white rounded-full inline-block animate-pulse mr-1"></div>
          Live Data
        </div>
      </div>
    </div>
  );
}

export default MarketStatsCards;
