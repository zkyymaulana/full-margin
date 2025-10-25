import {
  loginService,
  logoutService,
  registerService,
} from "../services/auth/auth.service.js";
import { verifyToken } from "../utils/jwt.js";

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
        lastLogin: user.lastLogin,
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
        lastLogin: user.lastLogin,
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
