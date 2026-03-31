export default function SettingsHeader({ t }) {
  return (
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
  );
}
