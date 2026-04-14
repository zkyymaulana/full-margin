import { FiInfo, FiActivity } from "react-icons/fi";
import WatchlistStatus from "./WatchlistStatus";
import ChatIdGuide from "./ChatIdGuide";
import PreferencesCard from "./PreferencesCard";

// TelegramSettingsCard: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export function TelegramSettingsCard({
  t,
  cardClass,
  isDarkMode,
  toggleDarkMode,
  userTelegramEnabled,
  handleTelegramToggle,
  isUserConfigured,
  updateTelegramMutationIsPending,
  watchlistCount,
  watchlistLoading,
  watchlistSymbols,
  telegramChatId,
  setTelegramChatId,
  handleSaveTelegramSettings,
  isSavingTelegram,
  hasChatIdChanged,
  isChatGuideOpen,
  setIsChatGuideOpen,
  isBackendConfigured,
  handleTestConnection,
  isTesting,
}) {
  return (
    <div className={cardClass}>
      <div className="p-4 md:p-6 space-y-4">
        <h2
          className={`text-lg md:text-xl font-semibold ${t(
            "text-white",
            "text-gray-900",
          )}`}
        >
          Preferences
        </h2>

        <PreferencesCard
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          t={t}
        />

        <div
          className={`p-4 rounded-lg space-y-4 ${t(
            "bg-gray-700/50",
            "bg-gray-50",
          )}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`font-semibold text-base md:text-lg ${t(
                  "text-white",
                  "text-gray-900",
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
                disabled={!isUserConfigured || updateTelegramMutationIsPending}
              />
              <div
                className={`w-11 h-6 rounded-full peer peer-focus:outline-none peer-focus:ring-4 ${t(
                  "bg-gray-600 peer-focus:ring-blue-800",
                  "bg-gray-200 peer-focus:ring-blue-300",
                )} peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                  isUserConfigured ? "peer-checked:bg-blue-600" : ""
                }`}
              />
            </label>
          </div>

          <p
            className={`text-xs md:text-sm ${t(
              "text-gray-400",
              "text-gray-500",
            )}`}
          >
            Receive trading signal alerts directly to your personal Telegram
            account.
          </p>

          <WatchlistStatus
            watchlistCount={watchlistCount}
            watchlistLoading={watchlistLoading}
            watchlistSymbols={watchlistSymbols}
            t={t}
          />

          <div className="space-y-2">
            <label
              className={`block text-xs md:text-sm font-medium ${t(
                "text-gray-300",
                "text-gray-700",
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
                  "bg-white border-gray-300 text-gray-900 placeholder-gray-400",
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
                  "text-gray-400",
                )}`}
              >
                <FiInfo className="shrink-0" />
                No changes detected. Modify Chat ID to enable save.
              </p>
            )}

            <ChatIdGuide
              isChatGuideOpen={isChatGuideOpen}
              setIsChatGuideOpen={setIsChatGuideOpen}
              t={t}
            />
          </div>

          {/* {!isBackendConfigured && (
            <div
              className={`flex items-start gap-2 p-3 rounded-lg ${t(
                "bg-red-900/20 text-red-400",
                "bg-red-50 text-red-700",
              )}`}
            >
              <span className="shrink-0 text-base leading-none">❌</span>
              <div>
                <p
                  className={`font-medium text-xs md:text-sm ${t(
                    "text-red-300",
                    "text-red-800",
                  )}`}
                >
                  Backend Not Configured
                </p>
                <p className="text-xs mt-0.5">
                  Set{" "}
                  <code
                    className={`px-1 rounded ${t(
                      "bg-red-900/40",
                      "bg-red-100",
                    )}`}
                  >
                    TELEGRAM_BOT_TOKEN
                  </code>{" "}
                  in the backend <code>.env</code> file.
                </p>
              </div>
            </div>
          )} */}

          {isUserConfigured && isBackendConfigured && userTelegramEnabled && (
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className={`w-full p-2.5 rounded-lg border transition-colors text-sm font-medium ${t(
                "bg-green-900/20 hover:bg-green-900/30 text-green-400 border-green-700/30",
                "bg-green-50 hover:bg-green-100 text-green-700 border-green-200",
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
  );
}

export default TelegramSettingsCard;
