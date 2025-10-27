import { useAuth } from "../hooks/useAuth";
import { useDarkMode } from "../contexts/DarkModeContext";
import { toast } from "react-toastify";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTelegramConfig,
  toggleTelegram,
  updateSignalMode,
  testTelegramConnection,
} from "../services/api.service";
import { useState } from "react";

function Settings() {
  const { user } = useAuth();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const queryClient = useQueryClient();
  const [isTesting, setIsTesting] = useState(false);

  // Fetch Telegram config
  const { data: telegramConfig, isLoading: configLoading } = useQuery({
    queryKey: ["telegramConfig"],
    queryFn: getTelegramConfig,
    refetchInterval: 30000, // Refresh setiap 30 detik
  });

  // Toggle Telegram mutation
  const toggleMutation = useMutation({
    mutationFn: toggleTelegram,
    onSuccess: (data) => {
      queryClient.invalidateQueries(["telegramConfig"]);
      toast.success(data.message || "Telegram settings updated");
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "Failed to update Telegram settings"
      );
    },
  });

  // Update signal mode mutation
  const updateModeMutation = useMutation({
    mutationFn: updateSignalMode,
    onSuccess: (data) => {
      queryClient.invalidateQueries(["telegramConfig"]);
      toast.success(data.message || "Signal mode updated");
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "Failed to update signal mode"
      );
    },
  });

  const handleTelegramToggle = () => {
    const currentState = telegramConfig?.config?.enabled || false;
    toggleMutation.mutate(!currentState);
  };

  const handleSignalModeChange = (mode) => {
    updateModeMutation.mutate(mode);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const result = await testTelegramConnection();
      if (result.success) {
        toast.success("✅ Test message sent! Check your Telegram");
      } else {
        toast.error("❌ Failed to send test message");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to test connection");
    } finally {
      setIsTesting(false);
    }
  };

  const handleResetCache = () => {
    // Clear all localStorage
    const darkModeValue = localStorage.getItem("darkMode");
    localStorage.clear();

    // Restore dark mode setting
    if (darkModeValue) {
      localStorage.setItem("darkMode", darkModeValue);
    }

    toast.success("Cache cleared successfully! Reloading...");

    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleForceRefresh = () => {
    // Force remove dark class
    document.documentElement.classList.remove("dark");
    document.body.classList.remove("dark");

    // Reset dark mode to false
    localStorage.setItem("darkMode", "false");

    toast.info("Force refreshing to light mode...");

    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const config = telegramConfig?.config || {};
  const isEnabled = config.enabled || false;
  const isConfigured = config.configured || false;
  const signalMode = config.signalMode || "multi";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className={`text-3xl font-bold ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          Settings
        </h1>
        <p className={`mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
          Manage your account and preferences
        </p>
      </div>

      {/* Preferences Card */}
      <div
        className={`rounded-xl shadow-sm ${
          isDarkMode ? "bg-gray-800 shadow-lg" : "bg-white"
        }`}
      >
        <div className="p-6">
          <h2
            className={`text-xl font-semibold mb-4 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            Preferences
          </h2>

          <div className="space-y-4">
            {/* Dark Mode Toggle */}
            <div
              className={`flex items-center justify-between p-4 rounded-lg ${
                isDarkMode ? "bg-gray-700/50" : "bg-gray-50"
              }`}
            >
              <div>
                <div
                  className={`font-medium ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  Dark Mode
                </div>
                <div
                  className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Switch to dark theme
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isDarkMode}
                  onChange={toggleDarkMode}
                />
                <div
                  className={`w-11 h-6 rounded-full peer peer-focus:outline-none peer-focus:ring-4 ${
                    isDarkMode
                      ? "bg-gray-600 peer-focus:ring-blue-800"
                      : "bg-gray-200 peer-focus:ring-blue-300"
                  } peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600`}
                ></div>
              </label>
            </div>

            {/* Telegram Notifications Toggle */}
            <div
              className={`flex items-center justify-between p-4 rounded-lg ${
                isDarkMode ? "bg-gray-700/50" : "bg-gray-50"
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`font-medium ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    📱 Telegram Notifications
                  </div>
                  {!isConfigured && (
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        isDarkMode
                          ? "bg-yellow-900/30 text-yellow-400"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      Not Configured
                    </span>
                  )}
                  {configLoading && (
                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  )}
                </div>
                <div
                  className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Receive trading signal alerts via Telegram
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isEnabled}
                  onChange={handleTelegramToggle}
                  disabled={!isConfigured || toggleMutation.isPending}
                />
                <div
                  className={`w-11 h-6 rounded-full peer peer-focus:outline-none peer-focus:ring-4 ${
                    isDarkMode
                      ? "bg-gray-600 peer-focus:ring-blue-800"
                      : "bg-gray-200 peer-focus:ring-blue-300"
                  } peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                    isConfigured
                      ? "peer-checked:bg-blue-600"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                ></div>
              </label>
            </div>

            {/* Signal Mode Selection */}
            {isConfigured && (
              <div
                className={`p-4 rounded-lg ${
                  isDarkMode ? "bg-gray-700/50" : "bg-gray-50"
                }`}
              >
                <div
                  className={`font-medium mb-3 ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  Signal Mode
                </div>
                <div className="space-y-2">
                  {[
                    {
                      value: "multi",
                      label: "Multi-Indicator",
                      emoji: "🎯",
                      desc: "Optimized combined signals (Recommended)",
                    },
                    {
                      value: "single",
                      label: "Single Indicator",
                      emoji: "📊",
                      desc: "Individual indicator signals",
                    },
                    {
                      value: "both",
                      label: "Both",
                      emoji: "📈",
                      desc: "All signals (may cause spam)",
                    },
                  ].map((mode) => (
                    <label
                      key={mode.value}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        signalMode === mode.value
                          ? isDarkMode
                            ? "bg-blue-900/30 border border-blue-500"
                            : "bg-blue-50 border border-blue-300"
                          : isDarkMode
                          ? "bg-gray-800 hover:bg-gray-750"
                          : "bg-white hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="signalMode"
                        value={mode.value}
                        checked={signalMode === mode.value}
                        onChange={(e) => handleSignalModeChange(e.target.value)}
                        disabled={updateModeMutation.isPending}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div
                          className={`font-medium ${
                            isDarkMode ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {mode.emoji} {mode.label}
                        </div>
                        <div
                          className={`text-sm ${
                            isDarkMode ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          {mode.desc}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Test Connection Button */}
            {isConfigured && (
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className={`w-full p-4 rounded-lg transition-colors ${
                  isDarkMode
                    ? "bg-green-900/20 hover:bg-green-900/30 text-green-400"
                    : "bg-green-50 hover:bg-green-100 text-green-700"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center justify-center gap-2">
                  {isTesting ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-green-500 border-t-transparent rounded-full"></div>
                      <span>Sending test message...</span>
                    </>
                  ) : (
                    <>
                      <span>🧪</span>
                      <span className="font-medium">
                        Test Telegram Connection
                      </span>
                    </>
                  )}
                </div>
              </button>
            )}

            {/* Configuration Warning */}
            {!isConfigured && (
              <div
                className={`p-4 rounded-lg ${
                  isDarkMode ? "bg-yellow-900/20" : "bg-yellow-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <div
                      className={`font-medium ${
                        isDarkMode ? "text-yellow-300" : "text-yellow-800"
                      }`}
                    >
                      Telegram Not Configured
                    </div>
                    <div
                      className={`text-sm mt-1 ${
                        isDarkMode ? "text-yellow-400" : "text-yellow-700"
                      }`}
                    >
                      Please configure your Telegram bot token and chat ID in
                      the backend environment variables (.env file).
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Troubleshooting Card */}
      <div
        className={`rounded-xl shadow-sm ${
          isDarkMode ? "bg-gray-800 shadow-lg" : "bg-white"
        }`}
      >
        <div className="p-6">
          <h2
            className={`text-xl font-semibold mb-4 flex items-center gap-2 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            <span>🔧</span> Troubleshooting
          </h2>
          <p
            className={`text-sm mb-4 ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Use these tools if dark mode is not working properly
          </p>

          <div className="space-y-3">
            <button
              onClick={handleForceRefresh}
              className={`w-full flex items-center justify-between p-4 rounded-lg transition-colors ${
                isDarkMode
                  ? "bg-yellow-900/20 hover:bg-yellow-900/30"
                  : "bg-yellow-50 hover:bg-yellow-100"
              }`}
            >
              <div className="text-left">
                <div
                  className={`font-medium ${
                    isDarkMode ? "text-yellow-300" : "text-yellow-800"
                  }`}
                >
                  🔄 Force Light Mode
                </div>
                <div
                  className={`text-sm ${
                    isDarkMode ? "text-yellow-400" : "text-yellow-600"
                  }`}
                >
                  Reset to light mode and reload
                </div>
              </div>
              <svg
                className={`w-5 h-5 ${
                  isDarkMode ? "text-yellow-400" : "text-yellow-600"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>

            <button
              onClick={handleResetCache}
              className={`w-full flex items-center justify-between p-4 rounded-lg transition-colors ${
                isDarkMode
                  ? "bg-blue-900/20 hover:bg-blue-900/30"
                  : "bg-blue-50 hover:bg-blue-100"
              }`}
            >
              <div className="text-left">
                <div
                  className={`font-medium ${
                    isDarkMode ? "text-blue-300" : "text-blue-800"
                  }`}
                >
                  🗑️ Clear Cache
                </div>
                <div
                  className={`text-sm ${
                    isDarkMode ? "text-blue-400" : "text-blue-600"
                  }`}
                >
                  Clear browser cache and reload
                </div>
              </div>
              <svg
                className={`w-5 h-5 ${
                  isDarkMode ? "text-blue-400" : "text-blue-600"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>

            <div
              className={`p-4 rounded-lg ${
                isDarkMode ? "bg-gray-700/50" : "bg-gray-50"
              }`}
            >
              <div
                className={`text-sm space-y-2 ${
                  isDarkMode ? "text-gray-300" : "text-gray-600"
                }`}
              >
                <p className="font-semibold">Current Status:</p>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      isDarkMode ? "bg-purple-500" : "bg-yellow-500"
                    }`}
                  ></span>
                  <span>Mode: {isDarkMode ? "Dark 🌙" : "Light ☀️"}</span>
                </div>
                <p className="text-xs mt-2">
                  💡 Tip: Press{" "}
                  <kbd
                    className={`px-2 py-1 rounded ${
                      isDarkMode
                        ? "bg-gray-600 text-gray-200"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    Ctrl + Shift + R
                  </kbd>{" "}
                  for hard refresh
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About Card */}
      <div
        className={`rounded-xl shadow-sm ${
          isDarkMode ? "bg-gray-800 shadow-lg" : "bg-white"
        }`}
      >
        <div className="p-6">
          <h2
            className={`text-xl font-semibold mb-4 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            About
          </h2>
          <div
            className={`space-y-2 text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            <p className="font-medium">Crypto Analyze Admin - React Version</p>
            <p>Version 2.0.0</p>
            <p>Built with React, TanStack Query, and Tailwind CSS</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
