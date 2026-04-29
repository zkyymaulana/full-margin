import { createContext, useContext, useState, useEffect } from "react";

const DarkModeContext = createContext();

// Hook helper untuk mengakses state dark mode.
export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error("useDarkMode must be used within DarkModeProvider");
  }
  return context;
};

export const DarkModeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Prioritas 1: baca preferensi yang pernah disimpan user.
    const saved = localStorage.getItem("darkMode");
    if (saved !== null) {
      return saved === "true";
    }

    // Prioritas 2: fallback ke preferensi sistem operasi/browser.
    if (window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    return false;
  });

  // Terapkan class tema ke root dokumen setiap state berubah.
  useEffect(() => {
    const root = document.documentElement;

    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Simpan preferensi agar persisten saat reload.
    localStorage.setItem("darkMode", isDarkMode.toString());

    // Update meta theme-color untuk browser mobile.
    updateMetaThemeColor(isDarkMode ? "#111827" : "#ffffff");

    // Log sederhana untuk bantu debugging tema.
  }, [isDarkMode]);

  // Toggle status dark mode.
  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Pastikan elemen meta theme-color selalu tersedia.
  const updateMetaThemeColor = (color) => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = color;
  };

  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
};
