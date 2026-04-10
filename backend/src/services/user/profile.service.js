import { prisma } from "../../lib/prisma.js";
import bcrypt from "bcryptjs";
import ImageKit from "imagekit";

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "",
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || "",
});

// Ambil data profil user yang aman ditampilkan ke frontend.
export async function getUserProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
      lastLogin: true,
      telegramChatId: true,
      telegramEnabled: true,
    },
  });
  if (!user) throw new Error("Akun tidak terdaftar");
  return user;
}

// Perbarui profil user (nama, email, password, avatar) sesuai input yang diberikan.
export async function updateUserProfile(userId, payload) {
  // Objek update dibentuk dinamis agar hanya field yang dikirim yang diproses.
  const updates = {};

  // Proses update nama.
  if (payload.name) {
    const name = String(payload.name).trim();
    if (name.length < 2) {
      throw new Error("Nama minimal 2 karakter");
    }
    updates.name = name;
  }

  // Proses update email dan pastikan email tidak dipakai user lain.
  if (payload.email) {
    const email = String(payload.email).trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists && exists.id !== userId) {
      throw new Error("Email sudah digunakan");
    }
    updates.email = email;
  }

  // Proses update password, wajib menyertakan currentPassword.
  if (payload.newPassword) {
    if (!payload.currentPassword) {
      throw new Error("Current password wajib diisi");
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("Akun tidak terdaftar");

    const ok = await bcrypt.compare(payload.currentPassword, user.passwordHash);
    if (!ok) throw new Error("Current password salah");

    if (String(payload.newPassword).length < 6) {
      throw new Error("Password minimal 6 karakter");
    }
    // Simpan password baru dalam bentuk hash.
    updates.passwordHash = await bcrypt.hash(String(payload.newPassword), 10);
  }

  // Proses update avatar lewat upload ImageKit.
  let uploadedUrl = null;
  if (payload.avatarBase64) {
    if (
      !process.env.IMAGEKIT_PUBLIC_KEY ||
      !process.env.IMAGEKIT_PRIVATE_KEY ||
      !process.env.IMAGEKIT_URL_ENDPOINT
    ) {
      throw new Error("Konfigurasi ImageKit belum diset");
    }

    const fileName = `avatar_${userId}_${Date.now()}.jpg`;
    const folder = process.env.IMAGEKIT_FOLDER || "/avatars";

    // Hilangkan prefix data URL jika format yang dikirim berupa data:image/...;base64,...
    const base64 = String(payload.avatarBase64).includes(",")
      ? String(payload.avatarBase64).split(",")[1]
      : String(payload.avatarBase64);

    const uploaded = await imagekit.upload({
      file: base64,
      fileName,
      folder,
      useUniqueFileName: true,
    });
    uploadedUrl = uploaded.url;
    updates.avatarUrl = uploadedUrl;
  }

  // Jika tidak ada field yang berubah, kembalikan error agar request tidak sia-sia.
  if (Object.keys(updates).length === 0) {
    throw new Error("Tidak ada perubahan yang dikirim");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updates,
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
      lastLogin: true,
    },
  });

  return { updated, uploadedUrl };
}

// Validasi bahwa user hanya dapat mengubah pengaturannya sendiri.
export function validateUserAuthorization(userId, authUserId) {
  if (userId !== authUserId) {
    throw new Error("Forbidden: You can only update your own settings");
  }
}

// Validasi tipe data input Telegram sebelum disimpan.
export function validateTelegramInput(telegramChatId, telegramEnabled) {
  // telegramChatId boleh string atau null.
  if (
    telegramChatId !== undefined &&
    typeof telegramChatId !== "string" &&
    telegramChatId !== null
  ) {
    throw new Error("telegramChatId must be a string or null");
  }

  // telegramEnabled harus boolean jika dikirim.
  if (telegramEnabled !== undefined && typeof telegramEnabled !== "boolean") {
    throw new Error("telegramEnabled must be a boolean");
  }
}

// Bentuk object update Telegram dari field yang benar-benar dikirim.
export function buildTelegramUpdateData(telegramChatId, telegramEnabled) {
  const updateData = {};

  if (telegramChatId !== undefined) {
    updateData.telegramChatId = telegramChatId;
  }

  if (telegramEnabled !== undefined) {
    updateData.telegramEnabled = telegramEnabled;
  }

  return updateData;
}

// Simpan pengaturan Telegram user dengan validasi prasyarat notifikasi.
export async function updateUserTelegramSettings(userId, updateData) {
  // Jika user ingin mengaktifkan notifikasi Telegram, cek prasyarat dulu.
  if (updateData.telegramEnabled === true) {
    // Prasyarat 1: harus punya chatId.
    if (updateData.telegramChatId === null) {
      throw new Error(
        "telegramChatId is required to enable Telegram notifications",
      );
    }

    if (updateData.telegramChatId === undefined) {
      // Jika tidak dikirim, cek apakah chatId sudah tersimpan sebelumnya.
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { telegramChatId: true },
      });
      if (!existingUser?.telegramChatId) {
        throw new Error(
          "Please save your Telegram Chat ID before enabling notifications",
        );
      }
    }

    // Prasyarat 2: user minimal punya satu coin di watchlist.
    const watchlistCount = await prisma.userWatchlist.count({
      where: { userId },
    });

    if (watchlistCount === 0) {
      throw new Error(
        "Add coins to your watchlist before enabling Telegram notifications",
      );
    }
  }

  // Simpan pengaturan Telegram setelah semua validasi terpenuhi.
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      telegramChatId: true,
      telegramEnabled: true,
    },
  });

  console.log(`Updated Telegram settings for user ${userId}`);
  return updatedUser;
}
