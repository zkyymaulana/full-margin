// Kumpulan hook autentikasi berbasis TanStack Query.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login, logout, register } from "../services/api.service";
import { useNavigate } from "react-router-dom";

// Hook login: kirim kredensial, simpan sesi, lalu redirect ke dashboard.
export const useLogin = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ email, password }) => login(email, password),
    onSuccess: (data) => {
      // Simpan data sesi agar user tetap login setelah reload.
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("userId", data.user?.id);
      localStorage.setItem("userEmail", data.user?.email);
      localStorage.setItem("userName", data.user?.name);
      localStorage.setItem("lastLogin", new Date().toISOString());

      // Arahkan ke dashboard setelah login berhasil.
      navigate("/dashboard");
    },
  });
};

// Hook register: buat akun, simpan sesi, lalu redirect.
export const useRegister = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ email, password, name }) => register(email, password, name),
    onSuccess: (data) => {
      // Simpan data sesi user baru.
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("userId", data.user?.id);
      localStorage.setItem("userEmail", data.user?.email);
      localStorage.setItem("userName", data.user?.name);
      localStorage.setItem("lastLogin", new Date().toISOString());

      // User langsung diarahkan ke dashboard.
      navigate("/dashboard");
    },
  });
};

// Hook logout: coba logout ke server lalu bersihkan state lokal.
export const useLogout = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Bersihkan data autentikasi lokal.
      localStorage.clear();

      // Bersihkan cache query agar data user lama tidak tersisa.
      queryClient.clear();

      // Kembalikan user ke halaman login.
      navigate("/login");
    },
    onError: () => {
      // Jika logout server gagal, data lokal tetap harus dibersihkan.
      localStorage.clear();
      queryClient.clear();
      navigate("/login");
    },
  });
};

// Hook utilitas untuk mengecek status autentikasi dari localStorage.
export const useAuth = () => {
  const { mutate: logoutMutation } = useLogout();
  const token = localStorage.getItem("authToken");
  const userId = localStorage.getItem("userId");
  const userEmail = localStorage.getItem("userEmail");
  const userName = localStorage.getItem("userName");

  const isAuthenticated = !!(token && userId && userEmail);

  // Bungkus mutate agar API dari hook lebih mudah dipakai komponen.
  const logout = () => {
    logoutMutation();
  };

  return {
    isAuthenticated,
    logout,
    user: isAuthenticated
      ? {
          id: userId,
          email: userEmail,
          name: userName,
          token,
        }
      : null,
  };
};
