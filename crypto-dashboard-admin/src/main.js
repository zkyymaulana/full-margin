import "./index.css";
import { Router } from "./router.js";
import { AuthMiddleware } from "./middleware/auth.middleware.js";
import { SidebarManager } from "./js/sidebar.js";
import { DashboardPage } from "./pages/dashboard.page.js";
import { IndicatorsPage } from "./pages/indicators.page.js";
import { SignalsPage } from "./pages/signals.page.js";
import { MarketCapPage } from "./pages/marketcap.page.js";
import { ComparisonPage } from "./pages/comparison.page.js";

console.log("✅ Vite + Tailwind setup works!");

// Global state
let router = null;
let authMiddleware = null;
let sidebarManager = null;
let currentPageInstance = null;
const pageInstances = new Map();

/**
 * Load HTML components with authentication check
 */
async function loadComponent(targetId, filePath) {
  const el = document.getElementById(targetId);
  if (!el) {
    console.error(`Element with ID '${targetId}' not found`);
    return;
  }

  try {
    console.log(`🌐 Loading component: ${filePath}`);

    // Add auth headers if available
    const headers = {};
    if (authMiddleware) {
      Object.assign(headers, authMiddleware.getAuthHeader());
    }

    const response = await fetch(filePath, { headers });
    if (!response.ok) {
      throw new Error(
        `Failed to load ${filePath} - Status: ${response.status}`
      );
    }

    const html = await response.text();
    el.innerHTML = html;

    console.log(`✅ Component loaded: ${filePath}`);

    // Special handling for sidebar - initialize SidebarManager
    if (targetId === "sidebar") {
      console.log("🔧 Initializing modular sidebar functionality...");

      // Wait for DOM to be ready, then initialize sidebar manager
      setTimeout(() => {
        if (!sidebarManager) {
          sidebarManager = new SidebarManager();
        }
        sidebarManager.initialize();

        // Make router globally accessible for sidebar
        window.router = router;
      }, 100);
    }
  } catch (err) {
    console.error(`❌ Error loading ${filePath}:`, err);
    el.innerHTML = `<div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded">Error loading component: ${err.message}</div>`;
  }
}

/**
 * Initialize sidebar navigation with auth check
 */
function initializeSidebarNavigation() {
  const sidebarLinks = document.querySelectorAll("[data-page]");

  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const pageName = link.getAttribute("data-page");

      // Check authentication before navigation
      if (authMiddleware && !authMiddleware.canAccessRoute(pageName)) {
        authMiddleware.redirectToLogin();
        return;
      }

      if (router) {
        router.navigateTo(pageName);
      }
    });
  });
}

/**
 * Initialize sidebar toggle functionality
 */
function initSidebarToggle() {
  const sidebarToggle = document.getElementById("headerCollapse");
  const sidebar = document.getElementById("application-sidebar-brand");
  const overlay = document.getElementById("sidebar-overlay");

  function toggleSidebar() {
    if (!sidebar) return;
    const isOpen = !sidebar.classList.contains("-translate-x-full");

    if (isOpen) {
      sidebar.classList.add("-translate-x-full");
      if (overlay) overlay.classList.add("hidden");
    } else {
      sidebar.classList.remove("-translate-x-full");
      if (overlay) overlay.classList.remove("hidden");
    }
  }

  function closeSidebar() {
    if (sidebar) sidebar.classList.add("-translate-x-full");
    if (overlay) overlay.classList.add("hidden");
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", toggleSidebar);
  }

  if (overlay) {
    overlay.addEventListener("click", closeSidebar);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSidebar();
    }
  });
}

/**
 * Get or create page instance
 */
function getPageInstance(pageName) {
  if (!pageInstances.has(pageName)) {
    let PageClass;

    switch (pageName) {
      case "dashboard":
        PageClass = DashboardPage;
        break;
      case "indicators":
        PageClass = IndicatorsPage;
        break;
      case "signals":
        PageClass = SignalsPage;
        break;
      case "comparison":
        PageClass = ComparisonPage;
        break;
      case "marketcap":
        PageClass = MarketCapPage;
        break;
      default:
        console.warn(`No page class found for: ${pageName}`);
        return null;
    }

    pageInstances.set(pageName, new PageClass());
  }

  return pageInstances.get(pageName);
}

/**
 * Initialize page-specific functionality with auth check
 */
window.initializePageFunctionality = async function (pageName) {
  console.log(`🔧 Initializing functionality for page: ${pageName}`);

  // Check authentication before page initialization
  if (authMiddleware && !authMiddleware.canAccessRoute(pageName)) {
    authMiddleware.redirectToLogin();
    return;
  }

  // Destroy current page instance if exists
  if (
    currentPageInstance &&
    typeof currentPageInstance.destroy === "function"
  ) {
    currentPageInstance.destroy();
  }

  // Get and initialize new page instance
  currentPageInstance = getPageInstance(pageName);

  if (
    currentPageInstance &&
    typeof currentPageInstance.initialize === "function"
  ) {
    await currentPageInstance.initialize();
  }
};

/**
 * Page visibility handling for performance
 */
function setupVisibilityHandling() {
  document.addEventListener("visibilitychange", () => {
    if (
      currentPageInstance &&
      typeof currentPageInstance.handleVisibilityChange === "function"
    ) {
      currentPageInstance.handleVisibilityChange(document.hidden);
    }
  });
}

/**
 * Setup authentication event listeners
 */
function setupAuthenticationEvents() {
  // Listen for storage changes (logout from another tab)
  window.addEventListener("storage", (event) => {
    if (event.key === "authToken" && !event.newValue) {
      console.log("🔒 Logout detected from another tab");
      window.location.href = "/src/pages/login.html";
    }
  });

  // Global logout function
  window.logout = function () {
    if (authMiddleware) {
      authMiddleware.logout();
    }
  };
}

/**
 * Show authentication status notification
 */
function showAuthNotification(user) {
  const notification = document.createElement("div");
  notification.className =
    "fixed top-4 right-4 z-50 p-4 bg-green-500 text-white rounded-lg shadow-lg";
  notification.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="text-lg">✅</span>
      <div>
        <div class="font-semibold">Welcome back!</div>
        <div class="text-sm">${user.name} (${user.email})</div>
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
 * Cleanup function
 */
function cleanup() {
  if (
    currentPageInstance &&
    typeof currentPageInstance.destroy === "function"
  ) {
    currentPageInstance.destroy();
  }

  // Clear all page instances
  pageInstances.forEach((instance) => {
    if (typeof instance.destroy === "function") {
      instance.destroy();
    }
  });
  pageInstances.clear();
}

/**
 * Main application initialization
 */
async function initApp() {
  console.log("🚀 Loading application components...");

  try {
    // Initialize authentication middleware first
    authMiddleware = new AuthMiddleware();

    // Make authMiddleware globally accessible
    window.authMiddleware = authMiddleware;

    // Check if user is authenticated
    if (!authMiddleware.isAuthenticated()) {
      console.log("🔒 User not authenticated, redirecting to login...");
      authMiddleware.redirectToLogin();
      return;
    }

    // Show welcome message for authenticated user
    const user = authMiddleware.getCurrentUser();
    if (user) {
      showAuthNotification(user);
    }

    // Load static components
    await Promise.all([
      loadComponent("topstrip", "/src/components/topstrip.html"),
      loadComponent("sidebar", "/src/components/sidebar.html"),
      loadComponent("header", "/src/components/header.html"),
      loadComponent("footer", "/src/components/footer.html"),
    ]);

    console.log("⏳ Initializing application modules...");

    // Wait for DOM to be ready
    setTimeout(() => {
      // Initialize sidebar navigation
      initializeSidebarNavigation();

      // Initialize sidebar toggle
      initSidebarToggle();

      // Initialize router (which includes auth middleware)
      router = new Router();

      // Setup visibility handling
      setupVisibilityHandling();

      // Setup authentication events
      setupAuthenticationEvents();

      // Update user info in sidebar
      setTimeout(() => {
        if (window.updateSidebarUserInfo) {
          window.updateSidebarUserInfo();
        }
      }, 500);

      console.log("✅ Application fully initialized");
    }, 100);
  } catch (error) {
    console.error("❌ Error initializing application:", error);

    // If there's an error and it might be auth-related, redirect to login
    if (authMiddleware) {
      authMiddleware.redirectToLogin();
    }
  }
}

// Cleanup on page unload
window.addEventListener("beforeunload", cleanup);

// Handle page visibility for performance
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    console.log("📱 Page hidden - pausing operations");
  } else {
    console.log("📱 Page visible - resuming operations");
  }
});

// Initialize application
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp, { once: true });
} else {
  initApp();
}
