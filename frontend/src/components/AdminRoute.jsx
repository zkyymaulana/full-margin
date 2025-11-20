import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/**
 * Admin Route Component
 * ====================
 * Middleware untuk melindungi route yang hanya bisa diakses admin
 *
 * Usage:
 * <AdminRoute>
 *   <AdminPanel />
 * </AdminRoute>
 *
 * Features:
 * - Cek authentication terlebih dahulu
 * - Cek role === "admin"
 * - Redirect ke /unauthorized jika bukan admin
 * - Loading state saat checking auth
 */
function AdminRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  // Loading state - Jika auth masih di-check
  // Uncomment jika useAuth() memiliki loading state
  // if (isLoading) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen">
  //       <div className="flex flex-col items-center gap-4">
  //         <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
  //         <p className="text-gray-600 dark:text-gray-400">
  //           Verifying admin access...
  //         </p>
  //       </div>
  //     </div>
  //   );
  // }

  // Jika tidak authenticated, redirect ke login
  if (!isAuthenticated) {
    console.log("🚫 [AdminRoute] User not authenticated, redirecting to login");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Jika authenticated tapi bukan admin, redirect ke unauthorized
  if (user?.role !== "admin") {
    console.log("⛔ [AdminRoute] Access denied - User is not admin");
    console.log("👤 [AdminRoute] User role:", user?.role || "undefined");
    console.log("📍 [AdminRoute] Attempted to access:", location.pathname);

    return <Navigate to="/unauthorized" replace />;
  }

  // Jika authenticated dan admin, render children
  console.log("✅ [AdminRoute] Admin access granted:", user?.email);
  return children;
}

export default AdminRoute;
