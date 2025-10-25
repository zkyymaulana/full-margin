import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSymbol } from "../contexts/SymbolContext";
import { useMarketcapSymbols } from "../hooks/useMarketcap";
import { useUserProfile } from "../hooks/useUser";
import { confirmLogout } from "../utils/notifications";
import { useDarkMode } from "../contexts/DarkModeContext";

function Header() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { selectedSymbol, setSelectedSymbol } = useSymbol();
  const { isDarkMode } = useDarkMode();
  const { data: symbolsData, isLoading: symbolsLoading } =
    useMarketcapSymbols();
  const { data: profileData } = useUserProfile();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const dropdownRef = useRef(null);
  const userDropdownRef = useRef(null);

  const symbols = symbolsData || [];
  const user = profileData?.data || {};

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target)
      ) {
        setIsUserDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter symbols based on search
  const filteredSymbols = symbols.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get current symbol info
  const currentSymbolInfo = symbols.find((s) => s.symbol === selectedSymbol);

  const handleSymbolSelect = (symbol) => {
    setSelectedSymbol(symbol);
    setIsDropdownOpen(false);
    setSearchQuery("");
  };

  const handleLogout = async () => {
    const confirmed = await confirmLogout();
    if (confirmed) {
      logout();
      navigate("/login");
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[100] shadow-sm border-b ${
        isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`xl:hidden p-2 rounded-lg ${
            isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
          }`}
          aria-label="Toggle sidebar"
        >
          <svg
            className={`w-6 h-6 ${isDarkMode ? "text-white" : "text-gray-900"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-2">
          <span
            className={`text-xl font-bold ${
              isDarkMode ? "text-blue-400" : "text-blue-600"
            }`}
          >
            Crypto Dashboard
          </span>
        </Link>

        {/* Symbol Selector Dropdown */}
        <div className="flex-1 max-w-md mx-4 relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-2 border rounded-lg transition-colors cursor-pointer ${
              isDarkMode
                ? "bg-gray-700 hover:bg-gray-600 border-gray-600"
                : "bg-gray-50 hover:bg-gray-100 border-gray-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                {currentSymbolInfo?.name?.charAt(0) || "?"}
              </div>
              <div className="text-left">
                <div
                  className={`text-sm font-semibold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {currentSymbolInfo?.name || selectedSymbol.split("-")[0]}
                </div>
                <div
                  className={`text-xs font-mono ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {selectedSymbol}
                </div>
              </div>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div
              className={`absolute top-full left-0 right-0 mt-2 border rounded-lg shadow-xl z-50 max-h-96 overflow-hidden flex flex-col ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-200"
              }`}
            >
              {/* Search Box */}
              <div
                className={`p-3 border-b ${
                  isDarkMode ? "border-gray-700" : "border-gray-200"
                }`}
              >
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search coins..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full px-4 py-2 pl-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                      isDarkMode
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-gray-50 border-gray-200 text-gray-900"
                    }`}
                    autoFocus
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">
                    🔍
                  </span>
                </div>
              </div>

              {/* Symbols List */}
              <div className="overflow-y-auto">
                {symbolsLoading ? (
                  <div
                    className={`p-4 text-center ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    <div className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="ml-2">Loading symbols...</span>
                  </div>
                ) : filteredSymbols.length === 0 ? (
                  <div
                    className={`p-4 text-center ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    No symbols found
                  </div>
                ) : (
                  filteredSymbols.map((symbol) => (
                    <button
                      key={symbol.symbol}
                      onClick={() => handleSymbolSelect(symbol.symbol)}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${
                        isDarkMode ? "hover:bg-gray-700" : "hover:bg-blue-50"
                      } ${
                        selectedSymbol === symbol.symbol
                          ? `${
                              isDarkMode ? "bg-gray-700" : "bg-blue-50"
                            } border-l-4 border-blue-500`
                          : ""
                      }`}
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm">
                        {symbol.name.charAt(0)}
                      </div>
                      <div className="flex-1 text-left">
                        <div
                          className={`text-sm font-semibold ${
                            isDarkMode ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {symbol.name}
                        </div>
                        <div
                          className={`text-xs font-mono ${
                            isDarkMode ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          {symbol.symbol}
                        </div>
                      </div>
                      <div
                        className={`text-xs font-medium ${
                          isDarkMode ? "text-gray-500" : "text-gray-400"
                        }`}
                      >
                        #{symbol.rank}
                      </div>
                      {selectedSymbol === symbol.symbol && (
                        <div className="text-blue-500">
                          <svg
                            className="w-5 h-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* Footer Info */}
              <div
                className={`p-2 border-t ${
                  isDarkMode
                    ? "border-gray-700 bg-gray-800"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div
                  className={`text-xs text-center ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {symbols.length} cryptocurrencies available
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Info with Dropdown */}
        <div className="relative" ref={userDropdownRef}>
          <button
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            className={`flex items-center gap-3 rounded-lg p-2 transition-colors cursor-pointer ${
              isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-50"
            }`}
          >
            <div className="hidden md:block text-right">
              <div
                className={`text-sm font-medium ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                {user?.name || "Admin User"}
              </div>
              <div
                className={`text-xs ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                {user?.email || "admin@crypto.com"}
              </div>
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold shadow-md">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{user?.name?.charAt(0) || "A"}</span>
              )}
            </div>
          </button>

          {/* User Dropdown Menu */}
          {isUserDropdownOpen && (
            <div
              className={`absolute right-0 top-full mt-2 w-64 border rounded-lg shadow-xl z-50 ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-200"
              }`}
            >
              {/* User Info Header */}
              <div
                className={`p-4 border-b ${
                  isDarkMode ? "border-gray-700" : "border-gray-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-lg shadow-md">
                    {user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{user?.name?.charAt(0) || "A"}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-semibold truncate ${
                        isDarkMode ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {user?.name || "Admin User"}
                    </div>
                    <div
                      className={`text-xs truncate ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      {user?.email || "admin@crypto.com"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="py-2">
                <Link
                  to="/profile"
                  onClick={() => setIsUserDropdownOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-50"
                  }`}
                >
                  <svg
                    className={`w-5 h-5 ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <div>
                    <div
                      className={`text-sm font-medium ${
                        isDarkMode ? "text-white" : "text-gray-900"
                      }`}
                    >
                      Profile
                    </div>
                    <div
                      className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Manage your account
                    </div>
                  </div>
                </Link>

                <Link
                  to="/settings"
                  onClick={() => setIsUserDropdownOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-50"
                  }`}
                >
                  <svg
                    className={`w-5 h-5 ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <div>
                    <div
                      className={`text-sm font-medium ${
                        isDarkMode ? "text-white" : "text-gray-900"
                      }`}
                    >
                      Settings
                    </div>
                    <div
                      className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      App preferences
                    </div>
                  </div>
                </Link>
              </div>

              {/* Logout */}
              <div
                className={`border-t py-2 ${
                  isDarkMode ? "border-gray-700" : "border-gray-200"
                }`}
              >
                <button
                  onClick={handleLogout}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors w-full text-left cursor-pointer ${
                    isDarkMode ? "hover:bg-red-900/20" : "hover:bg-red-50"
                  }`}
                >
                  <svg
                    className="w-5 h-5 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-red-600">
                      Logout
                    </div>
                    <div className="text-xs text-red-500">
                      Sign out from account
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
