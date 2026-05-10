import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { SymbolProvider } from "./contexts/SymbolContext";
import { SidebarProvider } from "./contexts/SidebarContext";
import { Layout, ProtectedRoute } from "./components/common";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import ProfilePage from "./pages/Profile";
import Unauthorized from "./pages/Unauthorized";
import SignalsPage from "./pages/Signals";
import ComparisonPage from "./pages/Comparison";
import MarketCapPage from "./pages/MarketCap";
import SettingsPage from "./pages/Settings";
import RegisterPage from "./pages/Register";

// Public Route (redirect if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <SymbolProvider>
      <SidebarProvider>
        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />

          {/* Unauthorized Page (standalone - no layout) */}
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Protected Routes with Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="signals" element={<SignalsPage />} />
            <Route path="comparison" element={<ComparisonPage />} />
            <Route path="marketcap" element={<MarketCapPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        {/* 🗑️ DISABLED - Progress card sekarang di dalam Comparison page */}
        {/* <GlobalOptimizationProgress /> */}
      </SidebarProvider>
    </SymbolProvider>
  );
}

export default App;
