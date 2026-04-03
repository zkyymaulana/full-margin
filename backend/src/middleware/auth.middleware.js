// src/middleware/auth.middleware.js
import { verifyToken } from "../utils/jwt.js";

// Middleware autentikasi: validasi Bearer token lalu simpan payload user ke request.
export function authMiddleware(req, res, next) {
  // Ambil header Authorization dari request.
  const authHeader = req.headers.authorization;

  // Pastikan format header mengikuti standar Bearer Token.
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Akses ditolak. Token tidak ditemukan.",
    });
  }

  // Pisahkan token dari string "Bearer <token>".
  const token = authHeader.split(" ")[1];

  // Verifikasi token menggunakan helper JWT terpusat.
  const decoded = verifyToken(token);

  // Jika token invalid atau expired, akses ditolak.
  if (!decoded) {
    return res.status(403).json({
      success: false,
      message: "Token tidak valid atau sudah kadaluarsa.",
    });
  }

  // Simpan data user hasil decode untuk dipakai handler berikutnya.
  req.user = decoded;
  next();
}
