import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import { useDarkMode } from "../../contexts/DarkModeContext";

// Layout: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
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

      <div className="flex flex-1 min-w-0">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 min-w-0 xl:ml-[270px] mt-[74px] flex flex-col">
          <div className="flex-1 w-full max-w-[1600px] mx-auto px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
            <Outlet />
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}

export { Layout };
export default Layout;
