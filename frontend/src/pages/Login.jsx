import { useState } from "react";
import { useLogin } from "../hooks/useAuth";
import { useDarkMode } from "../contexts/DarkModeContext";
import { showErrorToast, showSuccessToast } from "../utils/notifications";
import {
  AuthLayout,
  AuthCard,
  AuthHeader,
  LoginForm,
  GoogleAuthButton,
  AuthDivider,
  AuthFooterLink,
} from "../components/auth";

// Halaman login: autentikasi email/password atau Google.
function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { mutate: login, isLoading } = useLogin();

  // Handle submit login form standar.
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
            error?.response?.data?.message || "Login failed. Please try again.",
          );
        },
      },
    );
  };

  // Handle callback sukses dari Google OAuth.
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const response = await fetch("http://localhost:8000/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      const data = await response.json();

      if (data.success) {
        // Simpan sesi user setelah verifikasi backend sukses.
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

  // Handle callback gagal dari Google OAuth.
  const handleGoogleError = () => {
    showErrorToast("Google login failed. Please try again.");
  };

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeader title="Crypto Analyze" subtitle="Sign in to your account" />

        <LoginForm
          email={email}
          password={password}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          onEmailChange={(e) => setEmail(e.target.value)}
          onPasswordChange={(e) => setPassword(e.target.value)}
        />

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
      </AuthCard>
    </AuthLayout>
  );
}

export { LoginPage };
export default LoginPage;
