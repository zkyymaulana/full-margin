import { useState, useRef, useEffect, useMemo } from "react";
import { useUserProfile, useUpdateProfile } from "../hooks/useUser";
import { useAuth } from "../hooks/useAuth";
import { confirmLogout } from "../utils/notifications";
import { showSuccessToast, showErrorToast } from "../utils/notifications";
import { useDarkMode } from "../contexts/DarkModeContext";

import {
  ProfileHeader,
  ProfileCard,
  EditProfileForm,
  ChangePasswordForm,
} from "../components/profile";

// Halaman profil: kelola data akun, avatar, dan perubahan password.
function ProfilePage() {
  const { data: profileData, isLoading } = useUserProfile();
  const { mutate: updateProfile, isLoading: isUpdating } = useUpdateProfile();
  const { logout } = useAuth();
  const { isDarkMode } = useDarkMode();

  const user = profileData?.data || {};

  // State form profil + password.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarBase64, setAvatarBase64] = useState(null);

  const fileInputRef = useRef(null);

  // Isi form saat data profil berhasil dimuat.
  useEffect(() => {
    if (user.name) setName(user.name);
    if (user.email) setEmail(user.email);
  }, [user.name, user.email]);

  // Cek apakah ada perubahan profil yang perlu disimpan.
  const hasProfileChanges = useMemo(() => {
    const nameChanged = name !== user.name && name.trim() !== "";
    const hasNewAvatar = avatarBase64 !== null;
    return nameChanged || hasNewAvatar;
  }, [name, user.name, avatarBase64]);

  // Cek apakah form password sudah terisi lengkap.
  const hasPasswordInput = useMemo(() => {
    return (
      currentPassword.trim() !== "" &&
      newPassword.trim() !== "" &&
      confirmPassword.trim() !== ""
    );
  }, [currentPassword, newPassword, confirmPassword]);

  // Handle upload avatar dan siapkan preview base64.
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Buat preview gambar sebelum dikirim ke backend.
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
        setAvatarBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle update data profil (nama/avatar).
  const handleUpdateProfile = (e) => {
    e.preventDefault();

    const updateData = {
      // Email dipertahankan dari backend.
      email: user.email,
    };

    // Tambahkan field nama hanya jika berubah.
    if (name && name !== user.name) {
      updateData.name = name;
    }

    // Tambahkan avatar jika user memilih file baru.
    if (avatarBase64) {
      updateData.avatarBase64 = avatarBase64;
    }

    updateProfile(updateData, {
      onSuccess: (response) => {
        showSuccessToast(response.message || "Profile updated successfully!");
        setAvatarPreview(null);
        setAvatarBase64(null);
      },
      onError: (error) => {
        showErrorToast(
          error.response?.data?.message || "Failed to update profile",
        );
      },
    });
  };

  // Handle perubahan password dengan validasi dasar.
  const handleChangePassword = (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      showErrorToast("New password and confirmation do not match!");
      return;
    }

    if (newPassword.length < 6) {
      showErrorToast("Password must be at least 6 characters!");
      return;
    }

    const passwordData = {
      email: user.email,
      currentPassword,
      newPassword,
    };

    updateProfile(passwordData, {
      onSuccess: (response) => {
        showSuccessToast(response.message || "Password changed successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      },
      onError: (error) => {
        showErrorToast(
          error.response?.data?.message || "Failed to change password",
        );
      },
    });
  };

  // Logout dengan konfirmasi terlebih dahulu.
  const handleLogout = async () => {
    const confirmed = await confirmLogout();
    if (confirmed) {
      logout();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className={isDarkMode ? "text-gray-400" : "text-gray-500"}>
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProfileHeader isDarkMode={isDarkMode} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ProfileCard
            user={user}
            isDarkMode={isDarkMode}
            avatarPreview={avatarPreview}
            fileInputRef={fileInputRef}
            handleAvatarChange={handleAvatarChange}
          />
        </div>

        <div className="lg:col-span-2 space-y-6">
          <EditProfileForm
            isDarkMode={isDarkMode}
            name={name}
            setName={setName}
            email={email}
            setEmail={setEmail}
            avatarPreview={avatarPreview}
            handleUpdateProfile={handleUpdateProfile}
            isUpdating={isUpdating}
            hasProfileChanges={hasProfileChanges}
          />

          <ChangePasswordForm
            isDarkMode={isDarkMode}
            currentPassword={currentPassword}
            setCurrentPassword={setCurrentPassword}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            handleChangePassword={handleChangePassword}
            isUpdating={isUpdating}
            hasPasswordInput={hasPasswordInput}
          />
        </div>
      </div>

      <div className="flex justify-end mt-8">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 border border-red-500 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
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
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Logout
        </button>
      </div>
    </div>
  );
}

export { ProfilePage };
export default ProfilePage;
