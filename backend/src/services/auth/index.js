/**
 * File: src/services/auth/index.js
 * -------------------------------------------------
 * Tujuan: Barrel export (satu pintu) untuk service auth.
 * Memudahkan import di controller/route tanpa mengubah behavior.
 */

export {
  loginService,
  logoutService,
  registerService,
} from "./auth.service.js";
export { verifyGoogleToken } from "./google-auth.service.js";
