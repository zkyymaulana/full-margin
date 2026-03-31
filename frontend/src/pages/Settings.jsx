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
  SettingsHeader,
  TelegramSettingsCard,
  TechStackCard,
  AboutCard,
} from "../components/settings";

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
      <SettingsHeader t={t} />

      <TelegramSettingsCard
        t={t}
        cardClass={card}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        userTelegramEnabled={userTelegramEnabled}
        handleTelegramToggle={handleTelegramToggle}
        isUserConfigured={isUserConfigured}
        updateTelegramMutationIsPending={updateTelegramMutation.isPending}
        watchlistCount={watchlistCount}
        watchlistLoading={watchlistLoading}
        watchlistSymbols={watchlistSymbols}
        telegramChatId={telegramChatId}
        setTelegramChatId={setTelegramChatId}
        handleSaveTelegramSettings={handleSaveTelegramSettings}
        isSavingTelegram={isSavingTelegram}
        hasChatIdChanged={hasChatIdChanged}
        isChatGuideOpen={isChatGuideOpen}
        setIsChatGuideOpen={setIsChatGuideOpen}
        isBackendConfigured={isBackendConfigured}
        handleTestConnection={handleTestConnection}
        isTesting={isTesting}
      />

      <TechStackCard t={t} cardClass={card} />

      <AboutCard t={t} cardClass={card} />
    </div>
  );
}

export default SettingsPage;
