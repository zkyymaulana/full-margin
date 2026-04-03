import { FiChevronDown } from "react-icons/fi";

// ChatIdGuide: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export function ChatIdGuide({
  isChatGuideOpen,
  setIsChatGuideOpen,
  t,
}) {
  return (
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
          isChatGuideOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
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
                  "text-white",
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
  );
}

export default ChatIdGuide;
