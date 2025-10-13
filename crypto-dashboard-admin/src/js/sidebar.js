/**
 * Sidebar Module - Handle all sidebar functionality
 */
import { showNotification } from "./utils.js";

export class SidebarManager {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize sidebar functionality
   */
  initialize() {
    if (this.isInitialized) {
      console.log("⚠️ Sidebar already initialized");
      return;
    }

    console.log("🔧 Initializing Sidebar Manager...");

    // Update user info from localStorage
    this.updateUserInfoFromStorage();

    // Setup navigation
    this.setupNavigation();

    // Setup quick actions
    this.setupQuickActions();

    // Update sidebar status
    this.updateSidebarStatus();
    setInterval(() => this.updateSidebarStatus(), 30000);

    // Handle online/offline status
    window.addEventListener("online", () => this.updateSidebarStatus());
    window.addEventListener("offline", () => this.updateSidebarStatus());

    // Make functions globally available
    window.updateSidebarUserInfo = () => this.updateUserInfoFromStorage();
    window.handleLogoutClick = (event) => this.handleLogoutClick(event);
    window.showLogoutModal = () => this.showLogoutModal();

    this.isInitialized = true;
    console.log("✅ Sidebar Manager initialized successfully");
  }

  /**
   * Update user info from localStorage
   */
  updateUserInfoFromStorage() {
    const userName = localStorage.getItem("userName");
    const userEmail = localStorage.getItem("userEmail");

    if (userName && userEmail) {
      const userNameEl = document.querySelector(".sidebar-user-name");
      const userEmailEl = document.querySelector(".sidebar-user-email");
      const userAvatar = document.getElementById("user-avatar");

      if (userNameEl) userNameEl.textContent = userName;
      if (userEmailEl) userEmailEl.textContent = userEmail;
      if (userAvatar) userAvatar.textContent = userName.charAt(0).toUpperCase();

      console.log(`👤 User info updated: ${userName} (${userEmail})`);
    }
  }

  /**
   * Setup navigation links
   */
  setupNavigation() {
    const sidebarLinks = document.querySelectorAll("[data-page]");
    console.log(`🔍 Found ${sidebarLinks.length} navigation links`);

    sidebarLinks.forEach((link) => {
      const pageName = link.getAttribute("data-page");
      console.log(`📄 Setting up navigation for: ${pageName}`);

      link.addEventListener("click", (e) => {
        e.preventDefault();
        console.log(`🚀 Navigation clicked: ${pageName}`);

        // Update active state
        sidebarLinks.forEach((l) => {
          l.classList.remove("text-blue-600", "bg-blue-50");
          l.classList.add("text-gray-500");
        });

        e.target.classList.remove("text-gray-500");
        e.target.classList.add("text-blue-600", "bg-blue-50");

        // Use router for navigation
        if (window.router) {
          window.router.navigateTo(pageName);
        } else if (window.loadComponent) {
          window.loadComponent("content", `/src/pages/${pageName}.html`);
        } else {
          this.loadPageDirectly(pageName);
        }
      });
    });
  }

  /**
   * Load page directly as fallback
   */
  loadPageDirectly(pageName) {
    const contentElement = document.getElementById("content");
    if (!contentElement) {
      console.error("❌ Content element not found");
      return;
    }

    fetch(`/src/pages/${pageName}.html`)
      .then((response) => {
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        return response.text();
      })
      .then((html) => {
        contentElement.innerHTML = html;
        console.log(`✅ Successfully loaded ${pageName}.html`);

        if (window.initializePageFunctionality) {
          window.initializePageFunctionality(pageName);
        }
      })
      .catch((error) => {
        console.error(`❌ Error loading ${pageName}:`, error);
        contentElement.innerHTML = `
          <div class="p-8 text-center">
            <div class="text-6xl mb-4">😕</div>
            <h2 class="text-2xl font-bold text-gray-700 mb-2">Page Not Found</h2>
            <p class="text-gray-500 mb-4">Sorry, we couldn't load the ${pageName} page.</p>
            <button onclick="location.reload()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Refresh Page
            </button>
          </div>
        `;
      });
  }

  /**
   * Setup quick actions (refresh, cache, logout)
   */
  setupQuickActions() {
    console.log("🔧 Setting up quick actions...");

    // Refresh all data
    const refreshAllBtn = document.getElementById("refresh-all-data");
    if (refreshAllBtn) {
      refreshAllBtn.addEventListener("click", () => this.handleRefreshAll());
      console.log("✅ Refresh button event listener added");
    }

    // Clear cache
    const clearCacheBtn = document.getElementById("clear-cache-btn");
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener("click", () => this.handleClearCache());
      console.log("✅ Clear cache button event listener added");
    }

    // Logout functionality
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => this.handleLogoutClick(e));
      console.log("✅ Logout button event listener added");
    } else {
      console.error("❌ Logout button not found!");
    }
  }

  /**
   * Handle refresh all data
   */
  handleRefreshAll() {
    console.log("🔄 Refresh all data clicked");

    const refreshBtn = document.getElementById("refresh-all-data");
    const icon = refreshBtn?.querySelector("span");

    if (icon) {
      icon.style.transform = "rotate(360deg)";
      icon.style.transition = "transform 1s ease-in-out";
    }

    // Trigger global refresh
    if (window.dataPoller?.fetchData) {
      window.dataPoller.fetchData();
    }

    setTimeout(() => {
      if (icon) {
        icon.style.transform = "rotate(0deg)";
      }
      showNotification("All data refreshed successfully!", "success");
    }, 1000);
  }

  /**
   * Handle clear cache
   */
  handleClearCache() {
    console.log("🗑️ Clear cache clicked");

    if (window.cache) {
      window.cache.clear();
    }
    localStorage.removeItem("chartCache");
    sessionStorage.clear();

    showNotification("Cache cleared successfully!", "success");
  }

  /**
   * Handle logout button click
   */
  handleLogoutClick(event) {
    console.log("🚪 LOGOUT BUTTON CLICKED!", event);
    event.preventDefault();
    event.stopPropagation();

    try {
      this.showLogoutModal();
    } catch (error) {
      console.error("❌ Error showing logout modal:", error);
      // Fallback to simple confirm
      if (confirm("Are you sure you want to logout?")) {
        this.handleLogoutFallback();
      }
    }
  }

  /**
   * Show logout confirmation modal
   */
  showLogoutModal() {
    console.log("📱 Creating logout modal...");

    // Remove existing modal if any
    const existingModal = document.getElementById("logout-modal");
    if (existingModal) {
      document.body.removeChild(existingModal);
    }

    // Create modal
    const modal = document.createElement("div");
    modal.id = "logout-modal";
    modal.className =
      "fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50";

    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-all">
        <div class="p-6">
          <div class="flex items-center justify-center mb-4">
            <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <span class="text-2xl">🚪</span>
            </div>
          </div>
          
          <div class="text-center mb-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Confirm Logout</h3>
            <p class="text-gray-600">Are you sure you want to logout from your account?</p>
            <p class="text-sm text-gray-500 mt-1">You will be redirected to the login page.</p>
          </div>
          
          <div class="flex gap-3">
            <button id="cancel-logout" class="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button id="confirm-logout" class="flex-1 px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
              <span class="logout-text">Yes, Logout</span>
              <span class="logout-loading hidden">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Logging out...
              </span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Setup event listeners
    const cancelBtn = modal.querySelector("#cancel-logout");
    const confirmBtn = modal.querySelector("#confirm-logout");

    cancelBtn?.addEventListener("click", () => this.closeLogoutModal());
    confirmBtn?.addEventListener("click", () => this.handleLogout());

    // Close on backdrop click or Escape key
    modal.addEventListener("click", (e) => {
      if (e.target === modal) this.closeLogoutModal();
    });

    const escHandler = (e) => {
      if (e.key === "Escape") {
        this.closeLogoutModal();
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);

    console.log("✅ Logout modal created and displayed");
  }

  /**
   * Close logout modal
   */
  closeLogoutModal() {
    const modal = document.getElementById("logout-modal");
    if (modal && document.body.contains(modal)) {
      document.body.removeChild(modal);
      console.log("✅ Logout modal closed");
    }
  }

  /**
   * Handle logout process
   */
  async handleLogout() {
    console.log("🔒 Processing logout...");

    const modal = document.getElementById("logout-modal");
    const confirmBtn = modal?.querySelector("#confirm-logout");
    const logoutText = confirmBtn?.querySelector(".logout-text");
    const logoutLoading = confirmBtn?.querySelector(".logout-loading");

    // Show loading state
    if (logoutText && logoutLoading && confirmBtn) {
      logoutText.classList.add("hidden");
      logoutLoading.classList.remove("hidden");
      confirmBtn.disabled = true;
    }

    try {
      const token = localStorage.getItem("authToken");

      if (token) {
        showNotification("Logging out...", "info");

        // Call logout API
        const response = await fetch("http://localhost:8000/api/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          console.log("✅ Logout API call successful");
          showNotification("Logout successful!", "success");
        } else {
          console.warn("⚠️ Logout API failed, continuing with local logout");
        }
      }

      // Clear storage and redirect
      setTimeout(() => {
        localStorage.clear();
        sessionStorage.clear();
        this.closeLogoutModal();
        window.location.href = "/src/pages/login.html";
      }, 1000);
    } catch (error) {
      console.error("❌ Error during logout:", error);
      showNotification("Logout failed. Please try again.", "error");

      // Reset button state
      if (logoutText && logoutLoading && confirmBtn) {
        logoutText.classList.remove("hidden");
        logoutLoading.classList.add("hidden");
        confirmBtn.disabled = false;
      }
    }
  }

  /**
   * Fallback logout method
   */
  handleLogoutFallback() {
    console.log("🔄 Using fallback logout method");

    const token = localStorage.getItem("authToken");
    if (token) {
      fetch("http://localhost:8000/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }).finally(() => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/src/pages/login.html";
      });
    } else {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/src/pages/login.html";
    }
  }

  /**
   * Update sidebar status
   */
  updateSidebarStatus() {
    const lastUpdateEl = document.getElementById("sidebar-last-update");
    const statusEl = document.getElementById("sidebar-connection-status");

    if (lastUpdateEl) {
      lastUpdateEl.textContent = new Date().toLocaleTimeString();
    }

    if (statusEl) {
      statusEl.textContent = navigator.onLine ? "Connected" : "Offline";
      statusEl.className = navigator.onLine ? "text-green-300" : "text-red-300";
    }
  }
}
