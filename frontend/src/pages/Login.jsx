import { useState } from "react";
import { useLogin } from "../hooks/useAuth";
import { Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useDarkMode } from "../contexts/DarkModeContext";
import { HiMoon, HiSun } from "react-icons/hi";
import { showErrorToast, showSuccessToast } from "../utils/notifications";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { mutate: login, isLoading } = useLogin();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const handleSubmit = (e) => {
    e.preventDefault();
    login(
      { email, password },
      {
        onSuccess: () => {
          showSuccessToast("Login successful! Welcome back!");
        },
        onError: (error) => {
          showErrorToast(
            error?.response?.data?.message || "Login failed. Please try again."
          );
        },
      }
    );
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      // TODO: Send credential to backend for verification
      const response = await fetch("http://localhost:8000/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      const data = await response.json();

      if (data.success) {
        // Save to localStorage
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("userId", data.user.id);
        localStorage.setItem("userEmail", data.user.email);
        localStorage.setItem("userName", data.user.name);
        if (data.user.picture) {
          localStorage.setItem("userAvatar", data.user.picture);
        }

        showSuccessToast("Login with Google successful!");
        window.location.href = "/dashboard";
      } else {
        showErrorToast(data.message || "Google login failed");
      }
    } catch (error) {
      console.error("Google login error:", error);
      showErrorToast("Failed to login with Google");
    }
  };

  const handleGoogleError = () => {
    showErrorToast("Google login failed. Please try again.");
  };

  return (
    <div
      className={`min-h-screen ${
        isDarkMode
          ? "bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900"
          : "bg-gradient-to-br from-blue-500 to-purple-600"
      } flex items-center justify-center p-4 transition-colors duration-300`}
    >
      {/* Dark Mode Toggle - Top Right */}
      <button
        onClick={toggleDarkMode}
        className={`fixed top-4 right-4 p-3 rounded-full shadow-lg transition-all duration-300 ${
          isDarkMode
            ? "bg-gray-800 text-yellow-400 hover:bg-gray-700"
            : "bg-white text-gray-800 hover:bg-gray-100"
        }`}
        aria-label="Toggle dark mode"
      >
        {isDarkMode ? (
          <HiSun className="w-6 h-6" />
        ) : (
          <HiMoon className="w-6 h-6" />
        )}
      </button>

      <div
        className={`${
          isDarkMode ? "bg-gray-800" : "bg-white"
        } rounded-lg shadow-xl p-8 w-full max-w-md transition-colors duration-300`}
      >
        <div className="text-center mb-8">
          <div
            className={`inline-flex items-center justify-center w-16 h-16 ${
              isDarkMode
                ? "bg-gradient-to-br from-blue-600 to-purple-700"
                : "bg-gradient-to-br from-blue-500 to-purple-600"
            } rounded-full mb-4`}
          >
            <span className="text-3xl">📊</span>
          </div>
          <h1
            className={`text-3xl font-bold mb-2 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            Crypto Analyze
          </h1>
          <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                isDarkMode
                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  : "border-gray-300"
              }`}
              placeholder="admin@crypto.com"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className={`block text-sm font-medium mb-1 ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 ${
                  isDarkMode
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "border-gray-300"
                }`}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                  isDarkMode
                    ? "text-gray-400 hover:text-gray-300"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {showPassword ? (
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
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
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
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
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

        {/* Divider */}
        <div className="relative my-6">
          <div
            className={`absolute inset-0 flex items-center ${
              isDarkMode ? "text-gray-600" : "text-gray-300"
            }`}
          >
            <div className="w-full border-t"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span
              className={`px-2 ${
                isDarkMode
                  ? "bg-gray-800 text-gray-400"
                  : "bg-white text-gray-500"
              }`}
            >
              Or continue with
            </span>
          </div>
        </div>

        {/* Google Login Button */}
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            theme={isDarkMode ? "filled_black" : "outline"}
            size="large"
            text="signin_with"
            shape="rectangular"
            logo_alignment="left"
          />
        </div>

        {/* Register Link */}
        <div className="mt-6 text-center">
          <p
            className={`text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Don't have an account?{" "}
            <Link
              to="/register"
              className={`font-medium ${
                isDarkMode
                  ? "text-blue-400 hover:text-blue-300"
                  : "text-blue-600 hover:text-blue-700"
              }`}
            >
              Create one now
            </Link>
          </p>
        </div>

        {/* Demo Credentials */}
        <div
          className={`mt-6 pt-6 border-t ${
            isDarkMode ? "border-gray-700" : "border-gray-200"
          }`}
        >
          <div
            className={`rounded-lg p-4 ${
              isDarkMode ? "bg-blue-900/20" : "bg-blue-50"
            }`}
          >
            <p
              className={`text-xs font-semibold mb-2 ${
                isDarkMode ? "text-blue-300" : "text-blue-900"
              }`}
            >
              Demo Credentials:
            </p>
            <div
              className={`space-y-1 text-xs ${
                isDarkMode ? "text-blue-400" : "text-blue-700"
              }`}
            >
              <p>📧 Email: admin@crypto.com</p>
              <p>🔑 Password: admin123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
