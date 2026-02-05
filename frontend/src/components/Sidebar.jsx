import { NavLink } from "react-router-dom";
import { useLogout } from "../hooks/useAuth";
import { confirmLogout } from "../utils/notifications";
import { useState, useEffect } from "react";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useSidebar } from "../contexts/SidebarContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserProfile } from "../services/api.service";
import { FiBarChart2, FiTrendingUp, FiSliders } from "react-icons/fi";
import { FaCoins } from "react-icons/fa6";

function Sidebar() {
  const { mutate: logout } = useLogout();
  const { isDarkMode } = useDarkMode();
  const { isSidebarOpen, closeSidebar } = useSidebar();
  const queryClient = useQueryClient();

  // Fetch user profile to get Telegram status
  const { data: userProfile } = useQuery({
    queryKey: ["userProfile"],
    queryFn: getUserProfile,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get last data update time from React Query cache
  const [lastDataUpdate, setLastDataUpdate] = useState(new Date());

  useEffect(() => {
    // Function to get the most recent data update time
    const updateLastDataTime = () => {
      const queryCache = queryClient.getQueryCache();
      const queries = queryCache.getAll();

      // Filter for data queries (market data, indicators, etc.)
      const dataQueries = queries.filter((query) => {
        const queryKey = query.queryKey;
        return (
          queryKey &&
          queryKey.some(
            (key) =>
              typeof key === "string" &&
              (key.includes("indicator") ||
                key.includes("candles") ||
                key.includes("marketcap") ||
                key.includes("comparison") ||
                key === "symbols")
          ) &&
          query.state.dataUpdatedAt
        );
      });

      if (dataQueries.length > 0) {
        const mostRecentUpdate = Math.max(
          ...dataQueries.map((q) => q.state.dataUpdatedAt)
        );
        if (mostRecentUpdate > lastDataUpdate.getTime()) {
          setLastDataUpdate(new Date(mostRecentUpdate));
        }
      }
    };

    // Initial check
    updateLastDataTime();

    // Subscribe to query cache changes
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      updateLastDataTime();
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient, lastDataUpdate]);

  const handleLogout = async () => {
    const confirmed = await confirmLogout();
    if (confirmed) {
      logout();
    }
  };

  const menuItems = [
    {
      path: "/dashboard",
      icon: <FiBarChart2 />,
      label: "Dashboard",
      show: true,
    },
    {
      path: "/signals",
      icon: <FiTrendingUp />,
      label: "Signals",
      show: true,
    },
    {
      path: "/comparison",
      icon: <FiSliders />,
      label: "Comparison",
      show: true,
    },
    {
      path: "/marketcap",
      icon: <FaCoins />,
      label: "Market Cap",
      show: true,
    },
  ];

  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  // Check Telegram connection status
  const isTelegramConnected =
    userProfile?.data?.telegramEnabled && userProfile?.data?.telegramChatId;

  return (
    <>
      {/* Overlay untuk mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 xl:hidden  cursor-pointer"
          onClick={closeSidebar}
        />
      )}

      <aside
        id="sidebar"
        className={`fixed left-0 top-[74px] w-[270px] h-[calc(100vh-74px)] ${
          isDarkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-200"
        } border-r transform ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } xl:translate-x-0 transition-transform duration-300 z-40 flex flex-col`}
      >
        {/* Navigation Menu */}
        <nav className="flex-1 mt-4 p-4 space-y-2 overflow-y-auto cursor-pointer">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? isDarkMode
                      ? "bg-blue-900/20 text-blue-400"
                      : "bg-blue-50 text-blue-600"
                    : isDarkMode
                    ? "text-gray-300 hover:bg-gray-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`
              }
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom Info Card */}
        <div className="p-4">
          <div
            className={`bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl`}
          >
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 bg-white/60 rounded-full flex items-center justify-center backdrop-blur-sm">
                <img src="/images/logo.svg" alt="Logo" className="w-8 h-8" />
              </div>
            </div>

            <h3 className="text-center font-bold text-lg mb-1">
              Crypto Analyze Pro
            </h3>

            <p className="text-center text-xs text-white/80 mb-4">
              Real-time market analysis
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-white/70">Last Updated:</span>
                <span className="font-semibold">
                  {formatTime(lastDataUpdate)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white/70">Telegram:</span>
                <div className="flex items-center gap-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isTelegramConnected
                        ? "bg-green-400 animate-pulse"
                        : "bg-red-400"
                    }`}
                  ></span>
                  <span
                    className={`font-semibold ${
                      isTelegramConnected ? "text-green-300" : "text-red-300"
                    }`}
                  >
                    {isTelegramConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
