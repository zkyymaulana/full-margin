import { useState } from "react";
import { useRegister } from "../hooks/useAuth";
import { Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useDarkMode } from "../contexts/DarkModeContext";
import { HiMoon, HiSun } from "react-icons/hi";
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

function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { mutate: register, isLoading } = useRegister();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      showErrorToast("Passwords do not match!");
      return;
    }

    // Validate password length
    if (formData.password.length < 6) {
      showErrorToast("Password must be at least 6 characters long!");
      return;
    }

    register(
      {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      },
      {
        onSuccess: () => {
          showSuccessToast("Registration successful! Welcome aboard!");
        },
        onError: (error) => {
          showErrorToast(
            error?.response?.data?.message ||
              "Registration failed. Please try again."
          );
        },
      }
    );
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const response = await fetch("http://localhost:8000/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("userId", data.user.id);
        localStorage.setItem("userEmail", data.user.email);
        localStorage.setItem("userName", data.user.name);
        if (data.user.picture) {
          localStorage.setItem("userAvatar", data.user.picture);
        }

        showSuccessToast("Registration with Google successful!");
        window.location.href = "/dashboard";
      } else {
        showErrorToast(data.message || "Google registration failed");
      }
    } catch (error) {
      console.error("Google registration error:", error);
      showErrorToast("Failed to register with Google");
    }
  };

  const handleGoogleError = () => {
    showErrorToast("Google registration failed. Please try again.");
  };

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeader
          title="Create Account"
          subtitle="Join Crypto Analyze today"
        />

        <form onSubmit={handleSubmit} className="space-y-4">
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
              onChange={handleChange}
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
              onChange={handleChange}
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
              onChange={handleChange}
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
            onChange={handleChange}
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

        <AuthDivider text="Or register with" />

        <GoogleAuthButton
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          text="signup_with"
        />

        <AuthFooterLink
          text="Already have an account?"
          linkText="Sign in here"
          to="/login"
        />

        {/* Terms */}
        <div
          className={`mt-6 pt-6 border-t ${
            isDarkMode ? "border-gray-700" : "border-gray-200"
          }`}
        >
          <p
            className={`text-xs text-center ${
              isDarkMode ? "text-gray-500" : "text-gray-500"
            }`}
          >
            By creating an account, you agree to our{" "}
            <a
              href="#"
              className={`${
                isDarkMode
                  ? "text-blue-400 hover:underline"
                  : "text-blue-600 hover:underline"
              }`}
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="#"
              className={`${
                isDarkMode
                  ? "text-blue-400 hover:underline"
                  : "text-blue-600 hover:underline"
              }`}
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}

export default Register;
