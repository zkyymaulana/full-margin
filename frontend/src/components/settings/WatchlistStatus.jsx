import { FiList, FiAlertTriangle, FiPlusCircle } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

export default function WatchlistStatus({
  watchlistCount,
  watchlistLoading,
  watchlistSymbols,
  t,
}) {
  const navigate = useNavigate();
  console.log(watchlistSymbols);

  return (
    <div
      className={`rounded-lg border overflow-hidden ${t(
        "bg-gray-800/60 border-gray-600",
        "bg-white border-gray-200"
      )}`}
    >
      <div
        className={`flex items-center gap-2 px-3 py-2.5 ${t(
          "border-gray-700",
          "border-gray-100"
        )} ${watchlistCount === 0 ? "" : "border-b"}`}
      >
        <FiList
          className={`text-sm shrink-0 ${t("text-blue-400", "text-blue-600")}`}
        />
        <span
          className={`font-medium text-sm ${t("text-white", "text-gray-900")}`}
        >
          Watchlist Status
        </span>
        {watchlistLoading && (
          <div className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full ml-1" />
        )}
        {!watchlistLoading && (
          <span
            className={`ml-auto text-xs font-semibold px-1.5 py-0.5 rounded ${
              watchlistCount > 0
                ? t("bg-blue-900/40 text-blue-300", "bg-blue-100 text-blue-700")
                : t("bg-gray-700 text-gray-400", "bg-gray-100 text-gray-500")
            }`}
          >
            {watchlistCount} {watchlistCount === 1 ? "coin" : "coins"}
          </span>
        )}
      </div>

      <div className="px-3 py-2.5">
        {watchlistCount > 0 ? (
          <div className="space-y-3">
            <p className={`text-xs ${t("text-gray-400", "text-gray-500")}`}>
              You are monitoring{" "}
              <span
                className={`font-semibold ${t("text-white", "text-gray-800")}`}
              >
                {watchlistCount}
              </span>{" "}
              {watchlistCount === 1 ? "coin" : "coins"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {watchlistSymbols.map((sym) => (
                <span
                  key={sym}
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t(
                    "bg-blue-900/50 text-blue-300 border border-blue-700/50",
                    "bg-blue-50 text-blue-700 border border-blue-200"
                  )}`}
                >
                  {sym}
                </span>
              ))}

              {watchlistCount > 5 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${t(
                    "bg-gray-700 text-gray-400",
                    "bg-gray-100 text-gray-500"
                  )}`}
                >
                  +{watchlistCount - 5} more
                </span>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => navigate("/marketcap")}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors hover:cursor-pointer ${t(
                  "bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-700/40",
                  "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
                )}`}
              >
                <FiPlusCircle className="text-sm" />
                Manage Watchlist
              </button>
            </div>
          </div>
        ) : (
          <div className="py-2 space-y-3">
            <div
              className={`flex items-start gap-2 text-xs ${t(
                "text-yellow-400",
                "text-yellow-700"
              )}`}
            >
              <FiAlertTriangle className="mt-0.5 shrink-0 text-sm" />
              <div>
                <p className="font-medium">No coins in your watchlist yet.</p>
                <p className={`mt-0.5 ${t("text-gray-400", "text-gray-500")}`}>
                  Add coins to start receiving trading signal notifications.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/marketcap")}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${t(
                "bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-700/40",
                "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
              )}`}
            >
              <FiPlusCircle className="text-sm" />
              Add Coins to Watchlist
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
