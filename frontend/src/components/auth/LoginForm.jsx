import { useDarkMode } from "../../contexts/DarkModeContext";
import { PasswordInput } from "./PasswordInput";

export function LoginForm({
  email,
  password,
  isLoading,
  onSubmit,
  onEmailChange,
  onPasswordChange,
}) {
  const { isDarkMode } = useDarkMode();

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
          type="email"
          value={email}
          onChange={onEmailChange}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            isDarkMode
              ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              : "border-gray-300"
          }`}
          placeholder="admin@crypto.com"
          required
        />
      </div>

      <PasswordInput
        id="password"
        label="Password"
        value={password}
        onChange={onPasswordChange}
        required
      />

      <button
        type="submit"
        disabled={isLoading}
        className="cursor-pointer w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Signing in...
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
                d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
              />
            </svg>
            Sign In
          </>
        )}
      </button>
    </form>
  );
}

export default LoginForm;
