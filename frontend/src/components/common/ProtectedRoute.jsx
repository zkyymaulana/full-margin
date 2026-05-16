import { useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth, clearAuthSession } from "../../hooks/useAuth";
import { getUserProfile } from "../../services/api.service";
import { showErrorToast } from "../../utils/notifications";

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
// ProtectedRoute: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const hasShownKickToast = useRef(false);

  const { isFetching, isError, error } = useQuery({
    queryKey: ["auth", "profile-check"],
    queryFn: getUserProfile,
    enabled: isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const errorMessage = error?.response?.data?.message;
  const errorStatus = error?.response?.status;
  const shouldForceLogin =
    isAuthenticated &&
    isError &&
    (errorMessage === "Akun tidak terdaftar" ||
      errorMessage === "Unauthorized" ||
      errorMessage === "Token tidak ditemukan" ||
      errorMessage === "Token tidak valid" ||
      errorStatus === 401 ||
      errorStatus === 403);

  useEffect(() => {
    if (!shouldForceLogin) return;
    if (!hasShownKickToast.current) {
      showErrorToast("Your session is no longer valid. Please sign in again.");
      hasShownKickToast.current = true;
    }
    clearAuthSession();
  }, [shouldForceLogin]);

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
  if (!isAuthenticated || shouldForceLogin) {
    // Simpan current location untuk redirect setelah login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600 dark:text-gray-400">
          Checking account sessions...
        </p>
      </div>
    );
  }

  // Jika authenticated, render children
  return children;
}

export { ProtectedRoute };
export default ProtectedRoute;
