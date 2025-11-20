import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { SymbolProvider } from "./contexts/SymbolContext";
import { SidebarProvider } from "./contexts/SidebarContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Indicators from "./pages/Indicators";
import Comparison from "./pages/Comparison";
import MarketCap from "./pages/MarketCap";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Unauthorized from "./pages/Unauthorized";

// Public Route (redirect if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    console.log("✅ User already authenticated, redirecting to dashboard");
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
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
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
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="indicators" element={<Indicators />} />
            <Route path="comparison" element={<Comparison />} />
            <Route path="marketcap" element={<MarketCap />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />

            {/* Example: Admin-only route (uncomment when needed) */}
            {/* <Route
              path="admin"
              element={
                <AdminRoute>
                  <AdminPanel />
                </AdminRoute>
              }
            /> */}
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </SidebarProvider>
    </SymbolProvider>
  );
}

export default App;
