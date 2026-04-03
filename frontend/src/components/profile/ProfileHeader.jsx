// ProfileHeader: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export function ProfileHeader({ isDarkMode }) {
  return (
    <div>
      <h1
        className={`text-3xl font-bold ${
          isDarkMode ? "text-white" : "text-gray-900"
        }`}
      >
        Profile Settings
      </h1>
      <p className={`mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
        Manage your account settings and preferences
      </p>
    </div>
  );
}

export default ProfileHeader;
