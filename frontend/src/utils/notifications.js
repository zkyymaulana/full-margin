import Swal from "sweetalert2";
import { toast } from "react-toastify";

// Cek status dark mode dari localStorage agar tema popup konsisten.
const isDarkMode = () => {
  return localStorage.getItem("darkMode") === "true";
};

// Kumpulan helper SweetAlert2 untuk dialog konfirmasi.

export const confirmLogout = async () => {
  // Baca preferensi mode warna untuk menyesuaikan style popup.
  const darkMode = isDarkMode();

  // Tampilkan dialog konfirmasi logout dan tunggu aksi user.
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
  // Kembalikan true jika user menekan tombol konfirmasi.
  return result.isConfirmed;
};

export const confirmDelete = async (itemName = "this item") => {
  const darkMode = isDarkMode();

  // Dialog ini dipakai untuk aksi penghapusan yang bersifat kritis.
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
  confirmText = "Yes, proceed",
) => {
  const darkMode = isDarkMode();

  // Dialog generik yang bisa dipakai ulang untuk berbagai aksi.
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

// Kumpulan helper toast untuk notifikasi singkat non-blocking.

export const showSuccessToast = (message) => {
  // Toast sukses memakai durasi standar agar cepat hilang.
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
  // Toast error dibuat sedikit lebih lama agar pesan terbaca jelas.
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
  // Toast informasi untuk status netral.
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
  // Toast peringatan untuk kondisi yang perlu perhatian user.
  toast.warning(message, {
    position: "top-right",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

// Default export tetap dipertahankan agar kompatibel dengan impor lama.
export default {
  confirmLogout,
  confirmDelete,
  confirmAction,
  showSuccessToast,
  showErrorToast,
  showInfoToast,
  showWarningToast,
};
