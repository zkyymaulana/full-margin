import { useState } from "react";
import { useRegister } from "../hooks/useAuth";
import { useDarkMode } from "../contexts/DarkModeContext";
import { showErrorToast, showSuccessToast } from "../utils/notifications";
import {
  AuthLayout,
  AuthCard,
  AuthHeader,
  RegisterForm,
  GoogleAuthButton,
  AuthDivider,
  AuthFooterLink,
} from "../components/auth";

// Halaman register: pendaftaran akun baru via form atau Google.
function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const { mutate: register, isLoading } = useRegister();
  const { isDarkMode } = useDarkMode();

  // Handle perubahan field form register.
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Handle submit register dengan validasi dasar.
  const handleSubmit = (e) => {
    e.preventDefault();

    // Validasi kecocokan password dan konfirmasi.
    if (formData.password !== formData.confirmPassword) {
      showErrorToast("Passwords do not match!");
      return;
    }

    // Validasi panjang minimum password.
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
              "Registration failed. Please try again.",
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

  // Handle callback gagal dari Google OAuth.
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

        <RegisterForm
          formData={formData}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          onChange={handleChange}
        />

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
      </AuthCard>
    </AuthLayout>
  );
}

export { Register };
export default Register;
