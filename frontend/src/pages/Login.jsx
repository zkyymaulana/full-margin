import { useState } from "react";
import { useLogin } from "../hooks/useAuth";
import { GoogleLogin } from "@react-oauth/google";
import { useDarkMode } from "../contexts/DarkModeContext";
import { showErrorToast, showSuccessToast } from "../utils/notifications";
import {
  AuthLayout,
  AuthCard,
  AuthHeader,
  PasswordInput,
  GoogleAuthButton,
  AuthDivider,
  AuthFooterLink,
} from "../components/auth";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { mutate: login, isLoading } = useLogin();
  const { isDarkMode } = useDarkMode();

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
    <AuthLayout>
      <AuthCard>
        <AuthHeader title="Crypto Analyze" subtitle="Sign in to your account" />

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

          <PasswordInput
            id="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

        <AuthDivider text="Or continue with" />

        <GoogleAuthButton
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          text="signin_with"
        />

        <AuthFooterLink
          text="Don't have an account?"
          linkText="Create one now"
          to="/register"
        />

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
              <p>Email: admin@crypto.com</p>
              <p>Password: admin123</p>
            </div>
          </div>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}

export default LoginPage;
