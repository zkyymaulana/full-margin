import { useAuth } from "../hooks/useAuth";
import { useDarkMode } from "../contexts/DarkModeContext";
import { toast } from "react-toastify";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTelegramConfig,
  toggleTelegram,
  testTelegramConnection,
  updateUserTelegramSettings,
  getUserProfile,
} from "../services/api.service";
import { useState, useEffect } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiInfo,
  FiMessageCircle,
  FiMoon,
  FiRefreshCcw,
  FiSun,
  FiTool,
  FiTrash2,
  FiZap,
} from "react-icons/fi";

function SettingsPage() {
  const { user } = useAuth();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const queryClient = useQueryClient();
  const [isTesting, setIsTesting] = useState(false);

  // ✅ NEW: State untuk Telegram Chat ID
  const [telegramChatId, setTelegramChatId] = useState("");
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);

  // Fetch user profile (termasuk Telegram info)
  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: getUserProfile,
  });

  // ✅ Update state when userProfile changes
  useEffect(() => {
    if (userProfile?.data?.telegramChatId) {
      setTelegramChatId(userProfile.data.telegramChatId);
    }
  }, [userProfile]);

  // ✅ Check if Chat ID has changed (for Save button)
  const hasChatIdChanged =
    telegramChatId !== (userProfile?.data?.telegramChatId || "");

  // Fetch Telegram config (global backend config)
  const { data: telegramConfig, isLoading: configLoading } = useQuery({
    queryKey: ["telegramConfig"],
    queryFn: getTelegramConfig,
    refetchInterval: 30000, // Refresh setiap 30 detik
  });

  // ✅ NEW: Mutation untuk update Telegram user settings
  const updateTelegramMutation = useMutation({
    mutationFn: ({ userId, settings }) =>
      updateUserTelegramSettings(userId, settings),
    onSuccess: (data) => {
      queryClient.invalidateQueries(["userProfile"]);
      toast.success("Telegram settings saved successfully!");
      setIsSavingTelegram(false);
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "Failed to save Telegram settings"
      );
      setIsSavingTelegram(false);
    },
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

  // ✅ NEW: Handler untuk save Telegram settings
  const handleSaveTelegramSettings = () => {
    // Validasi Chat ID
    if (!telegramChatId || telegramChatId.trim() === "") {
      toast.error("Please enter your Telegram Chat ID");
      return;
    }

    // Validasi format (harus angka)
    if (!/^\d+$/.test(telegramChatId.trim())) {
      toast.error("Telegram Chat ID must be numeric");
      return;
    }

    if (!user?.id) {
      toast.error("User not found");
      return;
    }

    setIsSavingTelegram(true);
    updateTelegramMutation.mutate({
      userId: user.id,
      settings: {
        telegramChatId: telegramChatId.trim(),
        telegramEnabled: true, // Auto enable saat save
      },
    });
  };

  const handleTelegramToggle = () => {
    const currentEnabled = userProfile?.data?.telegramEnabled || false;
    const hasChatId = userProfile?.data?.telegramChatId;

    // Jika tidak ada Chat ID, blok toggle
    if (!hasChatId) {
      toast.warning("Please enter and save your Telegram Chat ID first!");
      return;
    }

    if (!user?.id) {
      toast.error("User not found");
      return;
    }

    // Toggle enabled status
    updateTelegramMutation.mutate({
      userId: user.id,
      settings: {
        telegramEnabled: !currentEnabled,
      },
    });
  };

  const handleTestConnection = async () => {
    const userChatId = userProfile?.data?.telegramChatId;
    const isEnabled = userProfile?.data?.telegramEnabled;

    // ✅ Cek apakah Chat ID sudah ada
    if (!userChatId) {
      toast.warning("⚠️ Please save your Telegram Chat ID first!");
      return;
    }

    // ✅ Cek apakah Telegram sudah diaktifkan
    if (!isEnabled) {
      toast.error(
        "Telegram notifications is disabled! Please enable it first by turning on the toggle switch."
      );
      return;
    }

    setIsTesting(true);
    try {
      const result = await testTelegramConnection();
      if (result.success) {
        toast.success("Test message sent! Check your Telegram");
      } else {
        toast.error("Failed to send test message");
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
  const isBackendConfigured = config.configured || false;

  // ✅ User-specific Telegram settings
  const userTelegramEnabled = userProfile?.data?.telegramEnabled || false;
  const userTelegramChatId = userProfile?.data?.telegramChatId || null;
  const isUserConfigured = !!userTelegramChatId;

  return (
    <div className="space-y-4 md:space-y-6 px-2 md:px-0">
      {/* Header */}
      <div>
        <h1
          className={`text-2xl md:text-3xl font-bold ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          Settings
        </h1>
        <p
          className={`mt-1 text-sm md:text-base ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          }`}
        >
          Manage your account and preferences
        </p>
      </div>

      {/* Preferences Card */}
      <div
        className={`rounded-xl shadow-sm ${
          isDarkMode ? "bg-gray-800 shadow-lg" : "bg-white"
        }`}
      >
        <div className="p-4 md:p-6">
          <h2
            className={`text-lg md:text-xl font-semibold mb-4 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            Preferences
          </h2>

          <div className="space-y-3 md:space-y-4">
            {/* Dark Mode Toggle */}
            <div
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 md:p-4 rounded-lg ${
                isDarkMode ? "bg-gray-700/50" : "bg-gray-50"
              }`}
            >
              <div className="flex-1">
                <div
                  className={`font-medium text-sm md:text-base ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  Dark Mode
                </div>
                <div
                  className={`text-xs md:text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Switch to dark theme
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer self-start sm:self-center">
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

            {/* ✅ UPDATED: Telegram Notifications Section */}
            <div
              className={`p-3 md:p-4 rounded-lg border-2 ${
                isUserConfigured
                  ? isDarkMode
                    ? "bg-gray-700/50 border-green-500/30"
                    : "bg-gray-50 border-green-300"
                  : isDarkMode
                  ? "bg-gray-700/50 border-yellow-500/30"
                  : "bg-gray-50 border-yellow-300"
              }`}
            >
              <div className="space-y-3 md:space-y-4">
                {/* Header dengan status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div
                      className={`font-medium text-base md:text-lg flex items-center gap-2 ${
                        isDarkMode ? "text-white" : "text-gray-900"
                      }`}
                    >
                      Telegram Notifications
                    </div>

                    {isUserConfigured ? (
                      <span
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                          isDarkMode
                            ? "bg-green-900/30 text-green-400"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        <FiCheckCircle className="text-sm" />
                        Connected
                      </span>
                    ) : (
                      <span
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                          isDarkMode
                            ? "bg-yellow-900/30 text-yellow-400"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        <FiAlertTriangle className="text-sm" />
                        Not Connected
                      </span>
                    )}
                    {profileLoading && (
                      <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    )}
                  </div>

                  {/* Toggle (hanya aktif jika sudah ada Chat ID) */}
                  <label className="relative inline-flex items-center cursor-pointer self-start sm:self-center">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={userTelegramEnabled}
                      onChange={handleTelegramToggle}
                      disabled={
                        !isUserConfigured || updateTelegramMutation.isPending
                      }
                    />
                    <div
                      className={`w-11 h-6 rounded-full peer peer-focus:outline-none peer-focus:ring-4 ${
                        isDarkMode
                          ? "bg-gray-600 peer-focus:ring-blue-800"
                          : "bg-gray-200 peer-focus:ring-blue-300"
                      } peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                        isUserConfigured
                          ? "peer-checked:bg-blue-600"
                          : "opacity-50 cursor-not-allowed"
                      }`}
                    ></div>
                  </label>
                </div>

                {/* Deskripsi */}
                <p
                  className={`text-xs md:text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Receive trading signal alerts directly to your personal
                  Telegram account
                </p>

                {/* Input Telegram Chat ID */}
                <div className="space-y-2">
                  <label
                    className={`block text-xs md:text-sm font-medium ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Telegram Chat ID
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      placeholder="Enter your Telegram Chat ID"
                      className={`flex-1 px-3 md:px-4 py-2 text-sm md:text-base rounded-lg border ${
                        isDarkMode
                          ? "bg-gray-800 border-gray-600 text-white placeholder-gray-500"
                          : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                    <button
                      onClick={handleSaveTelegramSettings}
                      disabled={
                        isSavingTelegram || !telegramChatId || !hasChatIdChanged
                      }
                      className={`px-4 md:px-6 py-2 rounded-lg font-medium text-sm md:text-base transition-colors w-full sm:w-auto ${
                        isDarkMode
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : "bg-blue-500 hover:bg-blue-600 text-white"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isSavingTelegram ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                          <span>Saving...</span>
                        </div>
                      ) : (
                        "Save"
                      )}
                    </button>
                  </div>
                  {!hasChatIdChanged && telegramChatId && (
                    <p className="flex items-center gap-1 text-xs text-gray-500">
                      <FiInfo className="text-sm flex-shrink-0" />
                      No changes detected. Modify Chat ID to enable save.
                    </p>
                  )}

                  <p className="flex items-start gap-1 text-xs text-gray-500">
                    <FiZap className="text-sm mt-0.5 flex-shrink-0" />
                    <span>
                      To get your Chat ID: Open Telegram, search for your bot,
                      send{" "}
                      <code
                        className={`px-1 py-0.5 rounded ${
                          isDarkMode ? "bg-gray-700" : "bg-gray-200"
                        }`}
                      >
                        /start
                      </code>
                      , and copy the Chat ID from the bot's reply.
                    </span>
                  </p>
                </div>

                {/* Warning jika backend belum configured */}
                {!isBackendConfigured && (
                  <div
                    className={`p-3 rounded-lg ${
                      isDarkMode ? "bg-red-900/20" : "bg-red-50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-base md:text-lg flex-shrink-0">
                        ❌
                      </span>
                      <div>
                        <div
                          className={`font-medium text-xs md:text-sm ${
                            isDarkMode ? "text-red-300" : "text-red-800"
                          }`}
                        >
                          Backend Not Configured
                        </div>
                        <div
                          className={`text-xs mt-1 ${
                            isDarkMode ? "text-red-400" : "text-red-700"
                          }`}
                        >
                          Please configure TELEGRAM_BOT_TOKEN in backend .env
                          file first.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Test Connection Button */}
            {isUserConfigured && isBackendConfigured && (
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className={`w-full p-3 md:p-4 rounded-lg transition-colors ${
                  isDarkMode
                    ? "bg-green-900/20 hover:bg-green-900/30 text-green-400"
                    : "bg-green-50 hover:bg-green-100 text-green-700"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center justify-center gap-2">
                  {isTesting ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-green-500 border-t-transparent rounded-full"></div>
                      <span className="text-sm md:text-base">
                        Sending test message...
                      </span>
                    </>
                  ) : (
                    <>
                      <FiActivity className="text-base md:text-lg" />
                      <span className="font-medium text-sm md:text-base">
                        Test Telegram Connection
                      </span>
                    </>
                  )}
                </div>
              </button>
            )}

            {/* Configuration Warning */}
            {!isBackendConfigured && (
              <div
                className={`p-3 md:p-4 rounded-lg ${
                  isDarkMode ? "bg-yellow-900/20" : "bg-yellow-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl md:text-2xl flex-shrink-0">⚠️</span>
                  <div>
                    <div
                      className={`font-medium text-sm md:text-base ${
                        isDarkMode ? "text-yellow-300" : "text-yellow-800"
                      }`}
                    >
                      Telegram Not Configured
                    </div>
                    <div
                      className={`text-xs md:text-sm mt-1 ${
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
        <div className="p-4 md:p-6">
          <h2
            className={`text-lg md:text-xl font-semibold mb-4 flex items-center gap-2 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            <FiTool className="text-base md:text-lg" />
            <span>Troubleshooting</span>
          </h2>
          <p
            className={`text-xs md:text-sm mb-4 ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Use these tools if dark mode is not working properly
          </p>

          <div className="space-y-3">
            <button
              onClick={handleForceRefresh}
              className={`w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 md:p-4 rounded-lg transition-colors ${
                isDarkMode
                  ? "bg-yellow-900/20 hover:bg-yellow-900/30"
                  : "bg-yellow-50 hover:bg-yellow-100"
              }`}
            >
              <div className="text-left">
                <div
                  className={`font-medium text-sm md:text-base ${
                    isDarkMode ? "text-yellow-300" : "text-yellow-800"
                  }`}
                >
                  Force Light Mode
                </div>
                <div
                  className={`text-xs md:text-sm ${
                    isDarkMode ? "text-yellow-200" : "text-yellow-600"
                  }`}
                >
                  Reset to light mode and reload
                </div>
              </div>
              <FiRefreshCcw
                className={`w-4 h-4 md:w-5 md:h-5 self-start sm:self-center ${
                  isDarkMode ? "text-yellow-400" : "text-yellow-600"
                }`}
              />
            </button>

            <button
              onClick={handleResetCache}
              className={`w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 md:p-4 rounded-lg transition-colors ${
                isDarkMode
                  ? "bg-blue-900/20 hover:bg-blue-900/30"
                  : "bg-blue-50 hover:bg-blue-100"
              }`}
            >
              <div className="text-left">
                <div
                  className={`font-medium text-sm md:text-base ${
                    isDarkMode ? "text-blue-300" : "text-blue-800"
                  }`}
                >
                  Clear Cache
                </div>
                <div
                  className={`text-xs md:text-sm ${
                    isDarkMode ? "text-blue-400" : "text-blue-600"
                  }`}
                >
                  Clear browser cache and reload
                </div>
              </div>
              <FiTrash2
                className={`w-4 h-4 md:w-5 md:h-5 self-start sm:self-center ${
                  isDarkMode ? "text-blue-400" : "text-blue-600"
                }`}
              />
            </button>

            <div
              className={`text-xs md:text-sm space-y-2 ${
                isDarkMode ? "text-gray-300" : "text-gray-600"
              }`}
            >
              <p className="font-semibold">Current Theme:</p>

              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    isDarkMode ? "bg-purple-500" : "bg-yellow-500"
                  }`}
                />

                <span className="flex items-center gap-1">
                  Mode:
                  {isDarkMode ? (
                    <>
                      Dark{" "}
                      <FiMoon className="ml-1 text-base md:text-lg text-purple-400" />
                    </>
                  ) : (
                    <>
                      Light{" "}
                      <FiSun className="ml-1 text-base md:text-lg text-yellow-500" />
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tech Stack Card */}
      <div
        className={`rounded-xl shadow-sm ${
          isDarkMode ? "bg-gray-800 shadow-lg" : "bg-white"
        }`}
      >
        <div className="p-4 md:p-6">
          <h2
            className={`text-lg md:text-xl font-semibold mb-4 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            Technology Stack
          </h2>
          <div
            className={`space-y-3 text-xs md:text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="font-semibold mb-2">Frontend</p>
                <ul className="space-y-1">
                  <li>• React 18</li>
                  <li>• React Router DOM</li>
                  <li>• TanStack Query (React Query)</li>
                  <li>• Tailwind CSS</li>
                  <li>• React Icons</li>
                  <li>• React Toastify</li>
                  <li>• Axios</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-2">Backend</p>
                <ul className="space-y-1">
                  <li>• Node.js + Express</li>
                  <li>• PostgreSQL</li>
                  <li>• Sequelize ORM</li>
                  <li>• JWT Authentication</li>
                  <li>• Telegram Bot API</li>
                  <li>• bcrypt</li>
                </ul>
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
        <div className="p-4 md:p-6">
          <h2
            className={`text-lg md:text-xl font-semibold mb-4 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            About
          </h2>
          <div
            className={`space-y-2 text-xs md:text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            <p className="font-medium">
              Crypto Analyze - Full Stack Application
            </p>
            <p>Version 2.0.0</p>
            <p>
              Built with React, Node.js, PostgreSQL, and modern web technologies
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
