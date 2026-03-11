import { useAuth } from "../hooks/useAuth";
import { useDarkMode } from "../contexts/DarkModeContext";
import { toast } from "react-toastify";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTelegramConfig,
  testTelegramConnection,
  updateUserTelegramSettings,
  getUserProfile,
  getWatchlist,
} from "../services/api.service";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronDown,
  FiInfo,
  FiList,
  FiPlusCircle,
  FiZap,
} from "react-icons/fi";

function SettingsPage() {
  const { user } = useAuth();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isTesting, setIsTesting] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [isChatGuideOpen, setIsChatGuideOpen] = useState(false);

  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: getUserProfile,
  });

  const { data: watchlistData, isLoading: watchlistLoading } = useQuery({
    queryKey: ["watchlist"],
    queryFn: getWatchlist,
  });

  const { data: telegramConfig, isLoading: configLoading } = useQuery({
    queryKey: ["telegramConfig"],
    queryFn: getTelegramConfig,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (userProfile?.data?.telegramChatId) {
      setTelegramChatId(userProfile.data.telegramChatId);
    }
  }, [userProfile]);

  const watchlistCoins = watchlistData?.data || [];
  const watchlistCount = watchlistCoins.length;
  const watchlistSymbols = watchlistCoins
    .slice(0, 5)
    .map((e) => e.coin?.symbol?.replace(/-USD$/i, "") || e.coin?.symbol)
    .filter(Boolean);

  const hasChatIdChanged =
    telegramChatId !== (userProfile?.data?.telegramChatId || "");

  const config = telegramConfig?.config || {};
  const isBackendConfigured = config.configured || false;
  const userTelegramEnabled = userProfile?.data?.telegramEnabled || false;
  const userTelegramChatId = userProfile?.data?.telegramChatId || null;
  const isUserConfigured = !!userTelegramChatId;

  const updateTelegramMutation = useMutation({
    mutationFn: ({ userId, settings }) =>
      updateUserTelegramSettings(userId, settings),
    onSuccess: () => {
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

  const handleSaveTelegramSettings = () => {
    if (!telegramChatId || telegramChatId.trim() === "") {
      toast.error("Please enter your Telegram Chat ID");
      return;
    }
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
      settings: { telegramChatId: telegramChatId.trim() },
    });
  };

  const handleTelegramToggle = () => {
    const currentEnabled = userProfile?.data?.telegramEnabled || false;
    const hasChatId = userProfile?.data?.telegramChatId;

    if (!currentEnabled) {
      if (!hasChatId) {
        toast.error("Please connect your Telegram Chat ID first.");
        return;
      }
      if (watchlistCount === 0) {
        toast.error(
          "Add coins to your watchlist before enabling notifications."
        );
        return;
      }
    }

    if (!user?.id) {
      toast.error("User not found");
      return;
    }

    updateTelegramMutation.mutate({
      userId: user.id,
      settings: { telegramEnabled: !currentEnabled },
    });
  };

  const handleTestConnection = async () => {
    if (!userTelegramChatId) {
      toast.warning("Please save your Telegram Chat ID first!");
      return;
    }
    if (!userTelegramEnabled) {
      toast.error(
        "Enable Telegram notifications before testing the connection."
      );
      return;
    }
    setIsTesting(true);
    try {
      const result = await testTelegramConnection();
      if (result.success) {
        toast.success("Test message sent! Check your Telegram.");
      } else {
        toast.error("Failed to send test message.");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to test connection");
    } finally {
      setIsTesting(false);
    }
  };

  const card = `rounded-xl shadow-sm ${
    isDarkMode ? "bg-gray-800 shadow-lg" : "bg-white"
  }`;
  const t = (dark, light) => (isDarkMode ? dark : light);

  return (
    <div className="space-y-4 md:space-y-6 px-2 md:px-0">
      <div>
        <h1
          className={`text-2xl md:text-3xl font-bold ${t(
            "text-white",
            "text-gray-900"
          )}`}
        >
          Settings
        </h1>
        <p
          className={`mt-1 text-sm md:text-base ${t(
            "text-gray-400",
            "text-gray-600"
          )}`}
        >
          Manage your account and preferences
        </p>
      </div>

      <div className={card}>
        <div className="p-4 md:p-6 space-y-4">
          <h2
            className={`text-lg md:text-xl font-semibold ${t(
              "text-white",
              "text-gray-900"
            )}`}
          >
            Preferences
          </h2>

          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 md:p-4 rounded-lg ${t(
              "bg-gray-700/50",
              "bg-gray-50"
            )}`}
          >
            <div>
              <div
                className={`font-medium text-sm md:text-base ${t(
                  "text-white",
                  "text-gray-900"
                )}`}
              >
                Dark Mode
              </div>
              <div
                className={`text-xs md:text-sm ${t(
                  "text-gray-400",
                  "text-gray-600"
                )}`}
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
                className={`w-11 h-6 rounded-full peer peer-focus:outline-none peer-focus:ring-4 ${t(
                  "bg-gray-600 peer-focus:ring-blue-800",
                  "bg-gray-200 peer-focus:ring-blue-300"
                )} peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600`}
              />
            </label>
          </div>

          <div
            className={`p-4 rounded-lg space-y-4 ${t(
              "bg-gray-700/50",
              "bg-gray-50"
            )}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`font-semibold text-base md:text-lg ${t(
                    "text-white",
                    "text-gray-900"
                  )}`}
                >
                  Telegram Notifications
                </span>
              </div>

              <label
                className={`relative inline-flex items-center self-start sm:self-center ${
                  !isUserConfigured
                    ? "cursor-not-allowed opacity-40"
                    : "cursor-pointer"
                }`}
              >
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
                  className={`w-11 h-6 rounded-full peer peer-focus:outline-none peer-focus:ring-4 ${t(
                    "bg-gray-600 peer-focus:ring-blue-800",
                    "bg-gray-200 peer-focus:ring-blue-300"
                  )} peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                    isUserConfigured ? "peer-checked:bg-blue-600" : ""
                  }`}
                />
              </label>
            </div>

            <p
              className={`text-xs md:text-sm ${t(
                "text-gray-400",
                "text-gray-500"
              )}`}
            >
              Receive trading signal alerts directly to your personal Telegram
              account.
            </p>

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
                  className={`text-sm shrink-0 ${t(
                    "text-blue-400",
                    "text-blue-600"
                  )}`}
                />
                <span
                  className={`font-medium text-sm ${t(
                    "text-white",
                    "text-gray-900"
                  )}`}
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
                        ? t(
                            "bg-blue-900/40 text-blue-300",
                            "bg-blue-100 text-blue-700"
                          )
                        : t(
                            "bg-gray-700 text-gray-400",
                            "bg-gray-100 text-gray-500"
                          )
                    }`}
                  >
                    {watchlistCount} {watchlistCount === 1 ? "coin" : "coins"}
                  </span>
                )}
              </div>

              <div className="px-3 py-2.5">
                {watchlistCount > 0 ? (
                  <div className="space-y-2">
                    <p
                      className={`text-xs ${t(
                        "text-gray-400",
                        "text-gray-500"
                      )}`}
                    >
                      You are monitoring{" "}
                      <span
                        className={`font-semibold ${t(
                          "text-white",
                          "text-gray-800"
                        )}`}
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
                        <p className="font-medium">
                          No coins in your watchlist yet.
                        </p>
                        <p
                          className={`mt-0.5 ${t(
                            "text-gray-400",
                            "text-gray-500"
                          )}`}
                        >
                          Add coins to start receiving trading signal
                          notifications.
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

            <div className="space-y-2">
              <label
                className={`block text-xs md:text-sm font-medium ${t(
                  "text-gray-300",
                  "text-gray-700"
                )}`}
              >
                Telegram Chat ID
              </label>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="e.g. 123456789"
                  className={`flex-1 px-3 md:px-4 py-2 text-sm md:text-base rounded-lg border ${t(
                    "bg-gray-800 border-gray-600 text-white placeholder-gray-500",
                    "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                  )} focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow`}
                />
                <button
                  onClick={handleSaveTelegramSettings}
                  disabled={
                    isSavingTelegram || !telegramChatId || !hasChatIdChanged
                  }
                  className="px-4 md:px-6 py-2 rounded-lg font-medium text-sm transition-colors w-full sm:w-auto bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSavingTelegram ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Saving...
                    </span>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>

              {!hasChatIdChanged && telegramChatId && (
                <p
                  className={`flex items-center gap-1 text-xs ${t(
                    "text-gray-500",
                    "text-gray-400"
                  )}`}
                >
                  <FiInfo className="shrink-0" />
                  No changes detected. Modify Chat ID to enable save.
                </p>
              )}

              <div
                className={`rounded-lg border overflow-hidden mt-1 ${t(
                  "border-gray-700",
                  "border-gray-200"
                )}`}
              >
                <button
                  type="button"
                  onClick={() => setIsChatGuideOpen((o) => !o)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors  hover:cursor-pointer ${t(
                    "bg-gray-800/60 hover:bg-gray-700/60 text-gray-300",
                    "bg-gray-50 hover:bg-gray-100 text-gray-700"
                  )}`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    How to get your Chat ID ?
                  </span>
                  <FiChevronDown
                    className={`shrink-0 text-sm transition-transform duration-200 ${
                      isChatGuideOpen ? "rotate-180" : "rotate-0"
                    } ${t("text-gray-400", "text-gray-500")}`}
                  />
                </button>

                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isChatGuideOpen
                      ? "max-h-64 opacity-100"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  <ol
                    className={`px-3 py-3 space-y-2 text-xs border-t ${t(
                      "border-gray-700 text-gray-400",
                      "border-gray-200 text-gray-600"
                    )}`}
                  >
                    {[
                      <>
                        Open the{" "}
                        <strong className={t("text-gray-200", "text-gray-800")}>
                          Telegram
                        </strong>{" "}
                        app
                      </>,
                      <>
                        Search for{" "}
                        <strong className={t("text-gray-200", "text-gray-800")}>
                          your bot
                        </strong>{" "}
                        by its username
                      </>,
                      <>
                        Send the command{" "}
                        <code
                          className={`px-1 py-0.5 rounded text-[11px] ${t(
                            "bg-gray-700 text-blue-300",
                            "bg-gray-200 text-blue-700"
                          )}`}
                        >
                          /start
                        </code>
                      </>,
                      <>
                        Copy the{" "}
                        <strong className={t("text-gray-200", "text-gray-800")}>
                          Chat ID
                        </strong>{" "}
                        from the bot&apos;s reply and paste it above
                      </>,
                    ].map((step, i) => (
                      <li key={i} className="flex items-center gap-2.5">
                        <span
                          className={`shrink-0 text-md font-bold mt-0.5 ${t(
                            "text-black",
                            "text-black"
                          )}`}
                        >
                          {i + 1}
                        </span>
                        <span className="text-md">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

            {!isBackendConfigured && (
              <div
                className={`flex items-start gap-2 p-3 rounded-lg ${t(
                  "bg-red-900/20 text-red-400",
                  "bg-red-50 text-red-700"
                )}`}
              >
                <span className="shrink-0 text-base leading-none">❌</span>
                <div>
                  <p
                    className={`font-medium text-xs md:text-sm ${t(
                      "text-red-300",
                      "text-red-800"
                    )}`}
                  >
                    Backend Not Configured
                  </p>
                  <p className="text-xs mt-0.5">
                    Set{" "}
                    <code
                      className={`px-1 rounded ${t(
                        "bg-red-900/40",
                        "bg-red-100"
                      )}`}
                    >
                      TELEGRAM_BOT_TOKEN
                    </code>{" "}
                    in the backend <code>.env</code> file.
                  </p>
                </div>
              </div>
            )}

            {isUserConfigured && isBackendConfigured && (
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className={`w-full p-2.5 rounded-lg border transition-colors text-sm font-medium ${t(
                  "bg-green-900/20 hover:bg-green-900/30 text-green-400 border-green-700/30",
                  "bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                )} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {isTesting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-green-500 border-t-transparent rounded-full" />
                    Sending test message...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <FiActivity /> Test Telegram Connection
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={card}>
        <div className="p-4 md:p-6">
          <h2
            className={`text-lg md:text-xl font-semibold mb-4 ${t(
              "text-white",
              "text-gray-900"
            )}`}
          >
            Technology Stack
          </h2>
          <div
            className={`text-xs md:text-sm ${t(
              "text-gray-400",
              "text-gray-600"
            )}`}
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
                  <li>• Prisma ORM</li>
                  <li>• JWT Authentication</li>
                  <li>• Telegram Bot API</li>
                  <li>• bcrypt</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={card}>
        <div className="p-4 md:p-6">
          <h2
            className={`text-lg md:text-xl font-semibold mb-4 ${t(
              "text-white",
              "text-gray-900"
            )}`}
          >
            About
          </h2>
          <div
            className={`space-y-1 text-xs md:text-sm ${t(
              "text-gray-400",
              "text-gray-600"
            )}`}
          >
            <p className="font-medium">
              Crypto Analyze — Full Stack Application
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
