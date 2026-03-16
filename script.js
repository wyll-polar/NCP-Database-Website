let supabaseClient = null;

function getSupabaseConfig() {
  return window.NCP_SUPABASE_CONFIG ?? {
    url: "PASTE_YOUR_SUPABASE_URL_HERE",
    anonKey: "PASTE_YOUR_SUPABASE_ANON_KEY_HERE",
  };
}

function hasSupabaseConfig() {
  const config = getSupabaseConfig();

  return (
    config.url !== "PASTE_YOUR_SUPABASE_URL_HERE" &&
    config.anonKey !== "PASTE_YOUR_SUPABASE_ANON_KEY_HERE"
  );
}

function initializeSupabase() {
  if (!window.supabase) {
    console.error("Supabase client library failed to load.");
    return null;
  }

  if (!hasSupabaseConfig()) {
    console.warn("Add your Supabase URL and anon key in supabase-config.js to enable Supabase features.");
    return null;
  }

  const config = getSupabaseConfig();
  return window.supabase.createClient(config.url, config.anonKey);
}

function getSearchElements() {
  return {
    searchForm: document.querySelector(".search-form"),
    searchInput: document.getElementById("search-page-input"),
    sortSelect: document.getElementById("search-sort"),
    resultsPanel: document.querySelector(".search-results-panel"),
    filters: document.querySelector(".search-filters"),
  };
}

function getSearchQueryFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("q")?.trim() ?? "";
}

function initializeLandingPage() {
  const landingForm = document.querySelector(".landing-search-form");
  const landingInput = document.getElementById("searchBar");

  if (!landingForm || !landingInput) {
    return;
  }

  landingForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const query = landingInput.value.trim();
    const searchUrl = new URL("search.html", window.location.href);

    if (query) {
      searchUrl.searchParams.set("q", query);
    }

    window.location.href = searchUrl.toString();
  });
}

function initializeSearchPage() {
  const elements = getSearchElements();

  if (!elements.searchForm) {
    return;
  }

  const initialQuery = getSearchQueryFromUrl();

  if (initialQuery && elements.searchInput) {
    elements.searchInput.value = initialQuery;
  }

  supabaseClient = initializeSupabase();

  // Placeholder submit handler.
  // Replace this with a real Supabase query once your table and search fields are finalized.
  elements.searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const query = elements.searchInput?.value.trim() ?? "";
    const searchUrl = new URL(window.location.href);

    if (query) {
      searchUrl.searchParams.set("q", query);
    } else {
      searchUrl.searchParams.delete("q");
    }

    window.history.replaceState({}, "", searchUrl);

    if (!supabaseClient) {
      console.warn("Supabase is not configured yet. Search term saved in URL only.");
      return;
    }

    console.log("Ready to run search for:", query);
  });
}

function renderLocationStatus(message) {
  const grid = document.getElementById("locations-grid");

  if (!grid) {
    return;
  }

  grid.innerHTML = `<p class="locations-status-message">${message}</p>`;
}

function renderLocations(locations) {
  const grid = document.getElementById("locations-grid");

  if (!grid) {
    return;
  }

  if (!Array.isArray(locations) || locations.length === 0) {
    renderLocationStatus("No locations found.");
    return;
  }

  grid.innerHTML = locations
    .map((location) => {
      const label = location["Location"] ?? "Unnamed location";
      return `<button class="location-card" type="button">${label}</button>`;
    })
    .join("");
}

async function initializeLocationsPage() {
  const grid = document.getElementById("locations-grid");

  if (!grid) {
    return;
  }

  supabaseClient = initializeSupabase();

  if (!supabaseClient) {
    renderLocationStatus("Supabase is not configured yet.");
    return;
  }

  renderLocationStatus("Loading locations...");

  const { data, error } = await supabaseClient
    .from("Locations")
    .select("*")
    .order("Location", { ascending: true });

  if (error) {
    console.error("Failed to load locations:", error);
    renderLocationStatus(`Could not load locations: ${error.message}`);
    return;
  }

  renderLocations(data);
}

function initializeApp() {
  initializeLandingPage();
  initializeSearchPage();
  initializeLocationsPage();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}

window.addEventListener("pageshow", () => {
  const searchInput = document.getElementById("search-page-input");
  const query = getSearchQueryFromUrl();

  if (searchInput && query) {
    searchInput.value = query;
  }
});
