import "./index.css";

console.log("✅ Vite + Tailwind setup works!");

/**
 * Dynamic HTML Loader untuk Vite
 * Memuat file HTML eksternal dan menyuntikkannya ke halaman utama.
 */
async function loadComponent(targetId, filePath) {
  const el = document.getElementById(targetId);
  if (!el) {
    console.error(`Element dengan ID '${targetId}' tidak ditemukan`);
    return;
  }

  try {
    const response = await fetch(filePath);
    if (!response.ok)
      throw new Error(`Gagal memuat ${filePath} - Status: ${response.status}`);
    const html = await response.text();
    el.innerHTML = html;
    console.log(`✅ Berhasil memuat komponen: ${filePath}`);
  } catch (err) {
    const errorMsg = `❌ Error loading ${filePath}: ${err.message}`;
    el.innerHTML = `<div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded">${errorMsg}</div>`;
    console.error(errorMsg);
  }
}

// Tunggu DOM siap sebelum memuat komponen
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Loading Spike template components...");

  // Muat komponen dengan struktur Spike
  loadComponent("topstrip", "/src/components/topstrip.html");
  loadComponent("sidebar", "/src/components/sidebar.html");
  loadComponent("header", "/src/components/header.html");
  loadComponent("content", "/src/pages/dashboard.html");
  loadComponent("footer", "/src/components/footer.html");
});

// Jika DOM sudah siap saat script dijalankan
if (document.readyState === "loading") {
  // DOM belum siap, tunggu event DOMContentLoaded
} else {
  // DOM sudah siap
  console.log("🚀 Loading Spike template components...");
  loadComponent("topstrip", "/src/components/topstrip.html");
  loadComponent("sidebar", "/src/components/sidebar.html");
  loadComponent("header", "/src/components/header.html");
  loadComponent("content", "/src/pages/dashboard.html");
  loadComponent("footer", "/src/components/footer.html");
}
