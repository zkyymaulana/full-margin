export default function EditProfileForm({
  isDarkMode,
  name,
  setName,
  email,
  setEmail,
  avatarPreview,
  handleUpdateProfile,
  isUpdating,
  hasProfileChanges,
}) {
  return (
    <div
      className={`rounded-xl shadow-sm border ${
        isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      <div className="p-6">
        <h2
          className={`text-xl font-semibold mb-4 ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          Edit Profile
        </h2>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label
              className={`block text-sm font-medium mb-1 ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isDarkMode
                  ? "border-gray-600 bg-gray-700 text-white"
                  : "border-gray-300 bg-white text-gray-900"
              }`}
              placeholder="Enter your name"
              required
            />
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-1 ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg cursor-not-allowed ${
                isDarkMode
                  ? "border-gray-600 bg-gray-700 text-white"
                  : "border-gray-300 bg-gray-100 text-gray-900"
              }`}
              placeholder="Enter your email"
              disabled
              readOnly
            />
            <p
              className={`text-xs mt-1 ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Email cannot be changed
            </p>
          </div>

          {avatarPreview && (
            <div
              className={`p-3 border rounded-lg ${
                isDarkMode
                  ? "bg-blue-900/20 border-blue-800"
                  : "bg-blue-50 border-blue-200"
              }`}
            >
              <div
                className={`flex items-center gap-2 text-sm ${
                  isDarkMode ? "text-blue-400" : "text-blue-700"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>New avatar selected. Click save to upload.</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isUpdating || !hasProfileChanges}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isUpdating ? "Saving..." : "Save Changes"}
          </button>
          {!hasProfileChanges && !isUpdating && (
            <p
              className={`text-xs text-center -mt-2 ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              No changes detected. Modify name or upload avatar to enable save.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
