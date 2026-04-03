/**
 * File: src/services/auth/index.js
 * -------------------------------------------------
 * Tujuan: Satu pintu export untuk semua service auth.
 * Format explicit memudahkan pemula melihat fungsi yang tersedia.
 */

export {
  registerService, // Registrasi user baru
  loginService, // Login user dengan email dan password
  logoutService, // Logout user (update last login)
} from "./auth.service.js";

export {
  verifyGoogleToken, // Verifikasi token Google OAuth
} from "./google-auth.service.js";
