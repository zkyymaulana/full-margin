import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
const JWT_EXPIRES_IN = "7d";

export function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}
