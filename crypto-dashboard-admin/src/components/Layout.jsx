import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import { useDarkMode } from "../contexts/DarkModeContext";

function Layout() {
  const { isDarkMode } = useDarkMode();

  return (
    <div
      className={`flex flex-col min-h-screen ${
        isDarkMode ? "bg-gray-900" : "bg-gray-50"
      }`}
    >
      {/* Header */}
      <Header />

      <div className="flex flex-1">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 xl:ml-[270px] mt-[64px] flex flex-col">
          <div className="flex-1 p-6">
            <Outlet />
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}

export default Layout;
