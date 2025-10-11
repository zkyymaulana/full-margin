// src/components/MarketcapTable.jsx

import { useMarketcap } from "../hooks/useMarketCap";

export default function MarketcapTable({
  live = true,
  onCoinSelect,
  selectedSymbol,
}) {
  const { data, isLoading, error, isFetching } = useMarketcap(live);

  if (isLoading) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900 text-gray-400">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
        <p>Memuat data marketcap...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-900 text-red-400">
        <div className="text-center">
          <p className="text-2xl font-semibold mb-2">❌ Gagal memuat data</p>
          <p className="text-sm text-gray-500">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-green-400">
          💹 Top 100 Marketcap ({live ? "Live" : "Cached"})
        </h1>
        {isFetching && (
          <span className="text-xs text-yellow-400 animate-pulse">
            ⟳ Updating...
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700 shadow-lg">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-800 text-gray-300 uppercase text-xs">
            <tr>
              <th className="p-3 text-left">#</th>
              <th className="p-3 text-left">Nama</th>
              <th className="p-3 text-left">Simbol</th>
              <th className="p-3 text-right">Harga Terakhir</th>
              <th className="p-3 text-right">Waktu Update</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-gray-700">
            {data.map((coin, i) => {
              const candle = coin.candles?.[0];
              const lastPrice = candle?.close ?? "-";
              const time = candle?.time
                ? new Date(Number(candle.time)).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  })
                : "-";

              // Create symbol with -USD suffix for chart compatibility
              const chartSymbol = `${coin.symbol}`;
              const isSelected = selectedSymbol === chartSymbol;

              return (
                <tr
                  key={coin.id}
                  onClick={() => onCoinSelect(chartSymbol)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-blue-800 hover:bg-blue-700 border-l-4 border-blue-400"
                      : "hover:bg-gray-800"
                  }`}
                  title={`Click to view ${coin.symbol} chart`}
                >
                  <td className="p-3">{i + 1}</td>
                  <td className="p-3">{coin.name || "-"}</td>
                  <td className="p-3 font-semibold">{coin.symbol}</td>
                  <td className="p-3 text-right text-green-400">
                    $
                    {typeof lastPrice === "number"
                      ? lastPrice.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })
                      : "-"}
                  </td>
                  <td className="p-3 text-right text-gray-400">{time}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Total: {data.length} aset | Update otomatis tiap{" "}
        {live ? "10 detik (live)" : "1 menit (cached)"} | Click pada baris untuk
        melihat chart
      </p>
    </div>
  );
}
