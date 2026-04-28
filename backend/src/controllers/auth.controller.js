import {
  loginService,
  logoutService,
  registerService,
  verifyGoogleToken,
} from "../services/auth/index.js";
import { verifyToken, generateToken } from "../utils/jwt.js";
import { prisma } from "../lib/prisma.js";

// Bentuk payload user yang konsisten untuk response auth.
function mapAuthUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    lastLogin: user.lastLogin,
  };
}

// Handle registrasi user baru lalu kirim token autentikasi.
export async function register(req, res) {
  try {
    // Ambil input utama dari body request.
    const { email, password, name } = req.body;
    const { token, user } = await registerService(email, password, name);

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: mapAuthUser(user),
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// Handle login user dengan email dan password.
export async function login(req, res) {
  try {
    // Validasi kredensial dilakukan di service.
    const { email, password } = req.body;
    const { token, user } = await loginService(email, password);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: mapAuthUser(user),
    });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
}

// Handle logout user berdasarkan token yang dikirim dari header Authorization.
export async function logout(req, res) {
  try {
    // Format header yang diharapkan: Bearer <token>.
    const token = req.headers.authorization?.split(" ")[1];
    if (!token)
      return res
        .status(401)
        .json({ success: false, message: "Token tidak ditemukan" });

    const decoded = verifyToken(token);
    if (!decoded)
      return res
        .status(401)
        .json({ success: false, message: "Token tidak valid" });

    // Service logout hanya mencatat aktivitas logout di auth log.
    await logoutService(decoded.id);
    res.json({ success: true, message: "Logout successful" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Handle login menggunakan Google OAuth.
export async function loginWithGoogle(req, res) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required",
      });
    }

    // Verifikasi token dari Google untuk mendapatkan data user.
    const googleUser = await verifyGoogleToken(credential);

    // Cek apakah user sudah ada di database berdasarkan email.
    let user = await prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    // Jika user belum ada, buat akun baru.
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          // User Google tidak memakai password lokal.
          passwordHash: "",
          avatarUrl: googleUser.picture,
        },
      });
    } else {
      // Jika sudah ada, perbarui waktu login terakhir dan avatar.
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLogin: new Date(),
          avatarUrl: googleUser.picture,
        },
      });
    }

    // Generate JWT untuk sesi login user.
    const token = generateToken({ id: user.id, email: user.email });

    res.json({
      success: true,
      message: "Login with Google successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.avatarUrl,
        lastLogin: user.lastLogin,
      },
    });
  } catch (err) {
    console.error("Google login error:", err);
    res.status(401).json({
      success: false,
      message: err.message || "Google login failed",
    });
  }
}
