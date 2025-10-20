// src/js/searchbar.js
import { getMarketcapSymbols } from "../services/api.service.js";

export async function initSearchBar() {
  const searchInput = document.getElementById("search-input");
  const resultsContainer = document.getElementById("search-results");
  const searchContainer = document.getElementById("search-container");

  if (!searchInput || !resultsContainer) {
    console.warn("⚠️ Search bar elements not found in DOM");
    return;
  }

  let symbols = [];
  let debounceTimer;

  async function loadSymbols() {
    try {
      symbols = await getMarketcapSymbols();
      console.log("✅ Loaded symbols:", symbols.length);
    } catch (err) {
      console.error("❌ Failed to load symbols:", err);
    }
  }

  await loadSymbols();

  function renderResults(filtered) {
    if (filtered.length === 0) {
      resultsContainer.innerHTML =
        '<p class="text-gray-500 text-sm px-4 py-2">No results found.</p>';
    } else {
      resultsContainer.innerHTML = filtered
        .map(
          (item) => `
          <div
            class="flex justify-between items-center px-4 py-2 hover:bg-blue-50 cursor-pointer transition-all"
            data-symbol="${item.symbol}"
          >
            <span class="font-medium text-gray-800">${item.name}</span>
            <span class="text-gray-500 text-sm">${item.symbol}</span>
          </div>`
        )
        .join("");
    }
    resultsContainer.classList.remove("hidden");
  }

  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.trim().toLowerCase();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (query.length > 0) {
        const filtered = symbols.filter(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.symbol.toLowerCase().includes(query)
        );
        renderResults(filtered);
      } else {
        resultsContainer.classList.add("hidden");
      }
    }, 200);
  });

  document.addEventListener("click", (e) => {
    if (!searchContainer.contains(e.target)) {
      resultsContainer.classList.add("hidden");
    }
  });

  resultsContainer.addEventListener("click", (e) => {
    const item = e.target.closest("[data-symbol]");
    if (item) {
      const symbol = item.getAttribute("data-symbol");
      searchInput.value = symbol;
      resultsContainer.classList.add("hidden");
      window.location.href = `/pages/marketcap.html?symbol=${symbol}`;
    }
  });
}
