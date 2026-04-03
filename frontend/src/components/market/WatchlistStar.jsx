import { FiStar } from "react-icons/fi";
import { AiFillStar } from "react-icons/ai";

// WatchlistStar: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export function WatchlistStar({
  coinId,
  isWatched,
  onToggle,
  isDarkMode,
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(coinId);
      }}
      title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
      className={`p-1 transition-all duration-150 hover:scale-125 focus:outline-none ${
        isDarkMode ? "hover:text-yellow-400" : "hover:text-yellow-500"
      }`}
    >
      {isWatched ? (
        <AiFillStar className="text-yellow-400 text-xl" />
      ) : (
        <FiStar
          className={`text-xl ${
            isDarkMode ? "text-gray-500" : "text-gray-400"
          }`}
        />
      )}
    </button>
  );
}

export default WatchlistStar;
