import { loginService, logoutService } from "../services/auth.service.js";
import { verifyToken } from "../utils/jwt.js";

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.headers["user-agent"];

    const { token, user } = await loginService(
      email,
      password,
      ipAddress,
      userAgent
    );

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
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ message: "Token tidak ditemukan" });

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ message: "Token tidak valid" });

    const ipAddress = req.ip;
    const userAgent = req.headers["user-agent"];
    await logoutService(decoded.id, ipAddress, userAgent);

    res.json({ success: true, message: "Logout berhasil" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
