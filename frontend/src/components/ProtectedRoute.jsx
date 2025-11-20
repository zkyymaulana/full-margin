import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/**
 * Protected Route Component
 * ========================
 * Middleware untuk melindungi route yang memerlukan authentication
 *
 * Usage:
 * <ProtectedRoute>
 *   <Dashboard />
 * </ProtectedRoute>
 *
 * Features:
 * - Auto redirect ke /login jika belum login
 * - Loading state saat checking auth
 * - Menyimpan intended destination untuk redirect setelah login
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  // Loading state - Jika auth masih di-check
  // Uncomment jika useAuth() memiliki loading state
  // if (isLoading) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen">
  //       <div className="flex flex-col items-center gap-4">
  //         <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
  //         <p className="text-gray-600 dark:text-gray-400">
  //           Checking authentication...
  //         </p>
  //       </div>
  //     </div>
  //   );
  // }

  // Jika tidak authenticated, redirect ke login
  if (!isAuthenticated) {
    console.log(
      "🚫 [ProtectedRoute] User not authenticated, redirecting to login"
    );
    console.log("📍 [ProtectedRoute] Attempted to access:", location.pathname);

    // Simpan current location untuk redirect setelah login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Jika authenticated, render children
  console.log("✅ [ProtectedRoute] User authenticated:", user?.email);
  return children;
}

export default ProtectedRoute;
