/**
 * Authentication Middleware
 */
export class AuthMiddleware {
  constructor() {
    this.protectedRoutes = [
      "dashboard",
      "indicators",
      "signals",
      "marketcap",
      "settings",
    ];
    this.publicRoutes = ["login"];
    this.loginUrl = "/src/pages/login.html";
    this.dashboardUrl = "/index.html";
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    const token = localStorage.getItem("authToken");
    const userId = localStorage.getItem("userId");
    const userEmail = localStorage.getItem("userEmail");

    return !!(token && userId && userEmail);
  }

  /**
   * Get current user data
   */
  getCurrentUser() {
    if (!this.isAuthenticated()) return null;

    return {
      id: localStorage.getItem("userId"),
      email: localStorage.getItem("userEmail"),
      name: localStorage.getItem("userName"),
      token: localStorage.getItem("authToken"),
      lastLogin: localStorage.getItem("lastLogin"),
    };
  }

  /**
   * Validate token format (basic validation)
   */
  isValidToken(token) {
    if (!token) return false;

    // Basic JWT format check (3 parts separated by dots)
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    try {
      // Try to decode the payload (without verification)
      const payload = JSON.parse(atob(parts[1]));

      // Check if token has expired
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        console.log("🔒 Token has expired");
        return false;
      }

      return true;
    } catch (error) {
      console.error("🔒 Invalid token format:", error);
      return false;
    }
  }

  /**
   * Check route access permissions
   */
  canAccessRoute(route) {
    // Public routes are always accessible
    if (this.publicRoutes.includes(route)) {
      return true;
    }

    // Protected routes require authentication
    if (this.protectedRoutes.includes(route)) {
      const isAuth = this.isAuthenticated();
      const token = localStorage.getItem("authToken");

      if (!isAuth || !this.isValidToken(token)) {
        console.log(`🚫 Access denied to ${route} - Authentication required`);
        return false;
      }

      return true;
    }

    // Default: allow access to unknown routes
    return true;
  }

  /**
   * Redirect to login if not authenticated
   */
  redirectToLogin() {
    console.log("🔒 Redirecting to login page...");
    window.location.href = this.loginUrl;
  }

  /**
   * Redirect to dashboard if already authenticated
   */
  redirectToDashboard() {
    console.log("✅ User already authenticated, redirecting to dashboard...");
    window.location.href = this.dashboardUrl;
  }

  /**
   * Logout user
   */
  logout() {
    console.log("🚪 Logging out user...");

    const token = localStorage.getItem("authToken");
    if (!token) {
      console.error("🔒 No token found, redirecting to login...");
      this.redirectToLogin();
      return;
    }

    // Send logout request to API
    fetch("http://localhost:8000/api/auth/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Logout failed: ${response.status}`);
        }
        console.log("✅ Logout successful");

        // Clear all authentication data
        localStorage.removeItem("authToken");
        localStorage.removeItem("userId");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userName");
        localStorage.removeItem("lastLogin");

        // Clear any cached data
        if (window.cache) window.cache.clear();
        sessionStorage.clear();

        // Redirect to login
        this.redirectToLogin();
      })
      .catch((error) => {
        console.error("❌ Error during logout:", error);
        alert("Logout failed. Please try again.");
      });
  }

  /**
   * Initialize auth middleware
   */
  init() {
    // Check authentication on page load
    this.checkAuthOnLoad();

    // Set up periodic token validation
    this.startTokenValidation();

    console.log("🔐 Auth middleware initialized");
  }

  /**
   * Check authentication status on page load
   */
  checkAuthOnLoad() {
    const currentPath = window.location.pathname;
    const isLoginPage = currentPath.includes("login.html");

    if (isLoginPage) {
      // If on login page and authenticated, redirect to dashboard
      if (this.isAuthenticated()) {
        this.redirectToDashboard();
      }
    } else {
      // If on protected page and not authenticated, redirect to login
      if (!this.isAuthenticated()) {
        this.redirectToLogin();
      }
    }
  }

  /**
   * Start periodic token validation
   */
  startTokenValidation() {
    // Check token validity every 5 minutes
    setInterval(() => {
      const token = localStorage.getItem("authToken");

      if (token && !this.isValidToken(token)) {
        console.log("🔒 Token validation failed, logging out...");
        this.showTokenExpiredNotification();
        setTimeout(() => this.logout(), 3000);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Show token expired notification
   */
  showTokenExpiredNotification() {
    const notification = document.createElement("div");
    notification.className =
      "fixed top-4 right-4 z-50 p-4 bg-red-500 text-white rounded-lg shadow-lg";
    notification.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-lg">⚠️</span>
        <div>
          <div class="font-semibold">Session Expired</div>
          <div class="text-sm">You will be redirected to login...</div>
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 4000);
  }

  /**
   * Get authorization header for API calls
   */
  getAuthHeader() {
    const token = localStorage.getItem("authToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Update user info in sidebar
   */
  updateUserInfo() {
    const user = this.getCurrentUser();
    if (!user) return;

    // Update user display in sidebar
    const userNameEl = document.querySelector(".sidebar-user-name");
    const userEmailEl = document.querySelector(".sidebar-user-email");

    if (userNameEl) userNameEl.textContent = user.name || "Admin User";
    if (userEmailEl) userEmailEl.textContent = user.email || "admin@crypto.com";
  }
}
