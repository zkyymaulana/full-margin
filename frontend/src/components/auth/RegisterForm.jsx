import { useDarkMode } from "../../contexts/DarkModeContext";
import { PasswordInput } from "./PasswordInput";

export function RegisterForm({ formData, isLoading, onSubmit, onChange }) {
  const { isDarkMode } = useDarkMode();

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="name"
          className={`block text-sm font-medium mb-1 ${
            isDarkMode ? "text-gray-300" : "text-gray-700"
          }`}
        >
          Full Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          value={formData.name}
          onChange={onChange}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            isDarkMode
              ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              : "border-gray-300"
          }`}
          placeholder="John Doe"
          required
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className={`block text-sm font-medium mb-1 ${
            isDarkMode ? "text-gray-300" : "text-gray-700"
          }`}
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={onChange}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            isDarkMode
              ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              : "border-gray-300"
          }`}
          placeholder="user@example.com"
          required
        />
      </div>

      <div>
        <PasswordInput
          id="password"
          name="password"
          label="Password"
          value={formData.password}
          onChange={onChange}
          required
          minLength={6}
        />
        <p
          className={`mt-1 text-xs ${
            isDarkMode ? "text-gray-400" : "text-gray-500"
          }`}
        >
          Must be at least 6 characters
        </p>
      </div>

      <PasswordInput
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm Password"
        value={formData.confirmPassword}
        onChange={onChange}
        required
      />

      <button
        type="submit"
        disabled={isLoading}
        className="hover:cursor-pointer w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Creating account...
          </>
        ) : (
          <>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
            Create Account
          </>
        )}
      </button>
    </form>
  );
}

export default RegisterForm;
