import { OAuth2Client } from "google-auth-library";

// Inisialisasi client OAuth Google menggunakan client ID dari environment.
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Verifikasi token Google dan kembalikan data profil dasar user.
export async function verifyGoogleToken(token) {
  try {
    // Validasi idToken terhadap audience agar token benar-benar untuk aplikasi ini.
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    // Ambil payload mentah dari token yang sudah lolos verifikasi.
    const payload = ticket.getPayload();

    // Kembalikan field yang dibutuhkan aplikasi.
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      emailVerified: payload.email_verified,
    };
  } catch (error) {
    // Error detail tetap dicatat di server untuk debugging.
    console.error("Error verifying Google token:", error);
    throw new Error("Invalid Google token");
  }
}
