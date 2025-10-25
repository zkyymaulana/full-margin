import { prisma } from "../../lib/prisma.js";
import bcrypt from "bcryptjs";
import ImageKit from "imagekit";

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "",
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || "",
});

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
    },
  });
  if (!user) throw new Error("User tidak ditemukan");
  return user;
}

export async function updateUserProfile(userId, payload) {
  const updates = {};

  // Update name
  if (payload.name) {
    const name = String(payload.name).trim();
    if (name.length < 2) {
      throw new Error("Nama minimal 2 karakter");
    }
    updates.name = name;
  }

  // Update email
  if (payload.email) {
    const email = String(payload.email).trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists && exists.id !== userId) {
      throw new Error("Email sudah digunakan");
    }
    updates.email = email;
  }

  // Update password (require currentPassword)
  if (payload.newPassword) {
    if (!payload.currentPassword) {
      throw new Error("Current password wajib diisi");
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User tidak ditemukan");

    const ok = await bcrypt.compare(payload.currentPassword, user.passwordHash);
    if (!ok) throw new Error("Current password salah");

    if (String(payload.newPassword).length < 6) {
      throw new Error("Password minimal 6 karakter");
    }
    updates.passwordHash = await bcrypt.hash(String(payload.newPassword), 10);
  }

  // Update avatar via ImageKit (accept base64 dataURL or plain base64)
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

    // Strip data URL prefix if present
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
