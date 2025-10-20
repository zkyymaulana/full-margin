/**
 * Router Module - Handle URL-based navigation with authentication
 */
import { AuthMiddleware } from "./middleware/auth.middleware.js";

export class Router {
  constructor() {
    this.routes = {
      dashboard: "/src/pages/dashboard.html",
      indicators: "/src/pages/indicators.html",
      comparison: "/src/pages/comparison.html",
      marketcap: "/src/pages/marketcap.html",
      settings: "/src/pages/settings.html",
    };
    this.currentRoute = "dashboard";
    this.authMiddleware = new AuthMiddleware();
    this.init();
  }

  init() {
    // Initialize authentication middleware first
    this.authMiddleware.init();

    // Handle browser back/forward buttons
    window.addEventListener("popstate", (event) => {
      const route = event.state?.route || this.getRouteFromURL();
      this.navigateTo(route, false);
    });

    // Load initial route from URL
    const initialRoute = this.getRouteFromURL();
    this.navigateTo(initialRoute, true);
  }

  getRouteFromURL() {
    const hash = window.location.hash.replace("#", "");
    return hash && this.routes[hash] ? hash : "dashboard";
  }

  navigateTo(route, pushState = true) {
    // Check authentication before navigation
    if (!this.authMiddleware.canAccessRoute(route)) {
      this.authMiddleware.redirectToLogin();
      return;
    }

    if (!this.routes[route]) {
      console.error(`Route '${route}' not found`);
      route = "dashboard";
    }

    this.currentRoute = route;

    // Update URL
    if (pushState) {
      const url = `${window.location.pathname}#${route}`;
      window.history.pushState({ route }, "", url);
    }

    // Update sidebar active state
    this.updateSidebarActiveState(route);

    // Load page content
    this.loadPage(route);

    console.log(`🚀 Navigated to: ${route}`);
  }

  updateSidebarActiveState(activeRoute) {
    const sidebarLinks = document.querySelectorAll("[data-page]");
    sidebarLinks.forEach((link) => {
      const linkPage = link.getAttribute("data-page");
      if (linkPage === activeRoute) {
        link.classList.remove("text-gray-500");
        link.classList.add("text-blue-600", "bg-blue-50");
      } else {
        link.classList.remove("text-blue-600", "bg-blue-50");
        link.classList.add("text-gray-500");
      }
    });
  }

  async loadPage(route) {
    const contentEl = document.getElementById("content");
    if (!contentEl) {
      console.error("Content element not found");
      return;
    }

    try {
      // Add fade-out effect
      contentEl.style.opacity = 0;

      setTimeout(async () => {
        // Add authorization header for API calls if needed
        const authHeaders = this.authMiddleware.getAuthHeader();

        const response = await fetch(this.routes[route], {
          headers: {
            ...authHeaders,
          },
        });

        if (!response.ok) {
          throw new Error(
            `Failed to load ${route} - Status: ${response.status}`
          );
        }

        const html = await response.text();
        contentEl.innerHTML = html;

        // Add fade-in effect
        contentEl.style.transition = "opacity 0.3s";
        contentEl.style.opacity = 1;

        // Initialize page-specific functionality
        if (window.initializePageFunctionality) {
          window.initializePageFunctionality(route);
        }

        // Update user info in sidebar after page load
        setTimeout(() => {
          this.authMiddleware.updateUserInfo();
        }, 100);

        console.log(`✅ Page loaded: ${route}`);
      }, 300);
    } catch (error) {
      console.error(`❌ Error loading page ${route}:`, error);
      contentEl.innerHTML = `<div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded">Error loading ${route}</div>`;
      contentEl.style.opacity = 1;
    }
  }

  getCurrentRoute() {
    return this.currentRoute;
  }

  getAuthMiddleware() {
    return this.authMiddleware;
  }
}
