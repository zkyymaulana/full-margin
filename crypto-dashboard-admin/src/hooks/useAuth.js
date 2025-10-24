/**
 * Hooks for Authentication using TanStack Query
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login, logout } from "../services/api.service";
import { useNavigate } from "react-router-dom";

// Login mutation
export const useLogin = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ email, password }) => login(email, password),
    onSuccess: (data) => {
      // Save auth data
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("userId", data.user?.id);
      localStorage.setItem("userEmail", data.user?.email);
      localStorage.setItem("userName", data.user?.name);
      localStorage.setItem("lastLogin", new Date().toISOString());

      // Redirect to dashboard
      navigate("/dashboard");
    },
  });
};

// Logout mutation
export const useLogout = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Clear all auth data
      localStorage.clear();

      // Clear all queries
      queryClient.clear();

      // Redirect to login
      navigate("/login");
    },
    onError: () => {
      // Even if logout fails on server, clear local data
      localStorage.clear();
      queryClient.clear();
      navigate("/login");
    },
  });
};

// Check if user is authenticated
export const useAuth = () => {
  const token = localStorage.getItem("authToken");
  const userId = localStorage.getItem("userId");
  const userEmail = localStorage.getItem("userEmail");
  const userName = localStorage.getItem("userName");

  const isAuthenticated = !!(token && userId && userEmail);

  return {
    isAuthenticated,
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
