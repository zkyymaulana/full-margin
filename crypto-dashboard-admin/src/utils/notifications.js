import Swal from "sweetalert2";
import { toast } from "react-toastify";

// =====================================================
// 🎨 SweetAlert2 Helpers (untuk konfirmasi)
// =====================================================

export const confirmLogout = async () => {
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
    customClass: {
      container: "swal-high-z-index",
    },
  });
  return result.isConfirmed;
};

export const confirmDelete = async (itemName = "this item") => {
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
    customClass: {
      container: "swal-high-z-index",
    },
  });
  return result.isConfirmed;
};

export const confirmAction = async (
  title,
  text,
  confirmText = "Yes, proceed"
) => {
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
    customClass: {
      container: "swal-high-z-index",
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
