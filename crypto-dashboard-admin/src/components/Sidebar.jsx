import { NavLink } from "react-router-dom";
import { useLogout } from "../hooks/useAuth";
import { confirmLogout } from "../utils/notifications";
import { useState, useEffect } from "react";
import { useDarkMode } from "../contexts/DarkModeContext";

function Sidebar() {
  const { mutate: logout } = useLogout();
  const [currentTime, setCurrentTime] = useState(new Date());
  const { isDarkMode } = useDarkMode();

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    const confirmed = await confirmLogout();
    if (confirmed) {
      logout();
    }
  };

  const menuItems = [
    { path: "/dashboard", icon: "📊", label: "Dashboard" },
    { path: "/indicators", icon: "📈", label: "Indicators" },
    { path: "/comparison", icon: "⚖️", label: "Comparison" },
    { path: "/marketcap", icon: "🪙", label: "Market Cap" },
  ];

  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  return (
    <aside
      id="sidebar"
      className={`fixed left-0 top-[74px] w-[270px] h-[calc(100vh-74px)] ${
        isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      } border-r transform -translate-x-full xl:translate-x-0 transition-transform duration-300 z-40 flex flex-col`}
    >
      {/* Navigation Menu */}
      <nav className="flex-1 mt-4 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
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
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <span className="text-2xl">🚀</span>
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
              <span className="font-semibold">{formatTime(currentTime)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/70">Status:</span>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span className="font-semibold text-green-300">Connected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
