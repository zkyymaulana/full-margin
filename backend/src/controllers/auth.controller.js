import {
  loginService,
  logoutService,
  registerService,
} from "../services/auth/auth.service.js";
import { verifyGoogleToken } from "../services/auth/google-auth.service.js";
import { verifyToken, generateToken } from "../utils/jwt.js";
import { prisma } from "../lib/prisma.js";
import { formatWibTime } from "../utils/time.js";

export async function register(req, res) {
  try {
    const { email, password, name } = req.body;
    const { token, user } = await registerService(email, password, name);

    res.status(201).json({
      success: true,
      message: "Registrasi berhasil",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        lastLogin: formatWibTime(user.lastLogin),
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const { token, user } = await loginService(email, password);

    res.json({
      success: true,
      message: "Login berhasil",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        lastLogin: formatWibTime(user.lastLogin),
      },
    });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
}

export async function logout(req, res) {
  try {
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

    await logoutService(decoded.id);
    res.json({ success: true, message: "Logout berhasil" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Login with Google OAuth
 */
export async function loginWithGoogle(req, res) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required",
      });
    }

    // Verify Google token
    const googleUser = await verifyGoogleToken(credential);

    // Check if user exists in database
    let user = await prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    // If user doesn't exist, create new user
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          passwordHash: "", // Google users don't have password - use passwordHash instead
          avatarUrl: googleUser.picture,
        },
      });
    } else {
      // Update last login and avatar if changed
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLogin: new Date(),
          avatarUrl: googleUser.picture,
        },
      });
    }

    // Generate JWT token
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
        lastLogin: formatWibTime(user.lastLogin),
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
