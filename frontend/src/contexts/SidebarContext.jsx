import { createContext, useContext, useState } from "react";

const SidebarContext = createContext();

// Hook helper untuk mengakses state sidebar.
export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Toggle buka/tutup sidebar.
  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  // Tutup sidebar secara paksa (misal saat navigasi).
  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <SidebarContext.Provider
      value={{ isSidebarOpen, toggleSidebar, closeSidebar }}
    >
      {children}
    </SidebarContext.Provider>
  );
};
