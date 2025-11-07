import { createContext, useContext, useState, useEffect } from "react";

const DarkModeContext = createContext();

export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error("useDarkMode must be used within DarkModeProvider");
  }
  return context;
};

export const DarkModeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage first
    const saved = localStorage.getItem("darkMode");
    if (saved !== null) {
      return saved === "true";
    }

    // Fallback to system preference
    if (window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    return false;
  });

  // Apply dark mode class to document
  useEffect(() => {
    const root = document.documentElement;

    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Save to localStorage
    localStorage.setItem("darkMode", isDarkMode.toString());

    // Update meta theme color
    updateMetaThemeColor(isDarkMode ? "#111827" : "#ffffff");

    // Debug log
    console.log(`🎨 Dark Mode: ${isDarkMode ? "ON 🌙" : "OFF ☀️"}`);
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

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
