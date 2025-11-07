import Swal from "sweetalert2";
import { toast } from "react-toastify";

// Helper to check if dark mode is enabled
const isDarkMode = () => {
  return localStorage.getItem("darkMode") === "true";
};

// =====================================================
// 🎨 SweetAlert2 Helpers (untuk konfirmasi)
// =====================================================

export const confirmLogout = async () => {
  const darkMode = isDarkMode();

  const result = await Swal.fire({
    title: "Logout Confirmation",
    text: "Are you sure you want to logout?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#3B82F6",
    cancelButtonColor: "#6B7280",
    confirmButtonText: "Yes, Logout",
    cancelButtonText: "Cancel",
    reverseButtons: true,
    backdrop: true,
    background: darkMode ? "#1F2937" : "#FFFFFF",
    color: darkMode ? "#F3F4F6" : "#111827",
    customClass: {
      container: "swal-high-z-index",
      popup: darkMode ? "dark-mode-popup" : "",
    },
  });
  return result.isConfirmed;
};

export const confirmDelete = async (itemName = "this item") => {
  const darkMode = isDarkMode();

  const result = await Swal.fire({
    title: "Are you sure?",
    text: `You won't be able to revert ${itemName}!`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#EF4444",
    cancelButtonColor: "#6B7280",
    confirmButtonText: "Yes, delete it!",
    cancelButtonText: "Cancel",
    reverseButtons: true,
    backdrop: true,
    background: darkMode ? "#1F2937" : "#FFFFFF",
    color: darkMode ? "#F3F4F6" : "#111827",
    customClass: {
      container: "swal-high-z-index",
      popup: darkMode ? "dark-mode-popup" : "",
    },
  });
  return result.isConfirmed;
};

export const confirmAction = async (
  title,
  text,
  confirmText = "Yes, proceed"
) => {
  const darkMode = isDarkMode();

  const result = await Swal.fire({
    title,
    text,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#3B82F6",
    cancelButtonColor: "#6B7280",
    confirmButtonText: confirmText,
    cancelButtonText: "Cancel",
    reverseButtons: true,
    backdrop: true,
    background: darkMode ? "#1F2937" : "#FFFFFF",
    color: darkMode ? "#F3F4F6" : "#111827",
    customClass: {
      container: "swal-high-z-index",
      popup: darkMode ? "dark-mode-popup" : "",
    },
  });
  return result.isConfirmed;
};

// =====================================================
// 🔔 Toast Helpers (untuk notifikasi singkat)
// =====================================================

export const showSuccessToast = (message) => {
  toast.success(message, {
    position: "top-right",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

export const showErrorToast = (message) => {
  toast.error(message, {
    position: "top-right",
    autoClose: 4000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

export const showInfoToast = (message) => {
  toast.info(message, {
    position: "top-right",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

export const showWarningToast = (message) => {
  toast.warning(message, {
    position: "top-right",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

export default {
  confirmLogout,
  confirmDelete,
  confirmAction,
  showSuccessToast,
  showErrorToast,
  showInfoToast,
  showWarningToast,
};
