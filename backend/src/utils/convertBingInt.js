/**
 * 🔹 Utility: Konversi semua BigInt ke Number agar bisa dikirim ke JSON
 * Rekursif untuk handle array & nested object
 */
export function convertBigIntToNumber(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber);
  } else if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key,
        convertBigIntToNumber(value),
      ])
    );
  } else if (typeof obj === "bigint") {
    return Number(obj);
  }
  return obj;
}
