let supabaseClient = null;
let currentSearchResults = [];
let currentSearchQuery = "";

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

function navigateToSearchWithQuery(query) {
  const searchUrl = new URL("search.html", window.location.href);
  const trimmedQuery = query.trim();

  if (trimmedQuery) {
    searchUrl.searchParams.set("q", trimmedQuery);
  }

  window.location.href = searchUrl.toString();
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
    navigateToSearchWithQuery(query);
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

  if (supabaseClient) {
    runSearchFromElements(elements);
  } else {
    renderSearchMessage("Search results", "Supabase is not configured yet", "Add your Supabase URL and anon key in supabase-config.js to enable search.");
  }

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

    await runSearchFromElements(elements);
  });

  document.querySelectorAll('input[name="result-type"]').forEach((input) => {
    input.addEventListener("change", async () => {
      if (!supabaseClient) {
        return;
      }

      await runSearchFromElements(elements);
    });
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getSelectedResultType() {
  return document.querySelector('input[name="result-type"]:checked')?.value ?? "all";
}

function makeLookupMap(rows, labelColumn) {
  return new Map((rows ?? []).map((row) => [row.id, row[labelColumn]]));
}

function makeMatrixLookupMap(rows, categoryLookup) {
  return new Map(
    (rows ?? []).map((row) => [
      row.id,
      {
        name: row["Name"],
        categoryId: row["category"],
        categoryName: categoryLookup.get(row["category"]) ?? "",
      },
    ])
  );
}

async function fetchLookupMaps() {
  const [
    locationsResponse,
    matrixResponse,
    matrixCategoriesResponse,
    contaminantsResponse,
    publicationTypesResponse,
  ] = await Promise.all([
    supabaseClient.from("Locations").select("id, Location"),
    supabaseClient.from("Matrix").select("id, Name, category"),
    supabaseClient.from("Matrix Categories").select("id, Categories"),
    supabaseClient.from("Contaminants").select("id, Name"),
    supabaseClient.from("Publication Types").select("id, Type"),
  ]);

  const lookupError =
    locationsResponse.error ||
    matrixResponse.error ||
    matrixCategoriesResponse.error ||
    contaminantsResponse.error ||
    publicationTypesResponse.error;

  if (lookupError) {
    throw lookupError;
  }

  const matrixCategories = makeLookupMap(matrixCategoriesResponse.data, "Categories");

  return {
    locations: makeLookupMap(locationsResponse.data, "Location"),
    matrix: makeMatrixLookupMap(matrixResponse.data, matrixCategories),
    matrixCategories,
    contaminants: makeLookupMap(contaminantsResponse.data, "Name"),
    publicationTypes: makeLookupMap(publicationTypesResponse.data, "Type"),
  };
}

function searchableTextMatches(fields, query) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();

  return fields
    .filter((field) => field !== null && field !== undefined)
    .some((field) => String(field).toLowerCase().includes(normalizedQuery));
}

function isAnimalCategory(categoryName) {
  return String(categoryName ?? "").toLowerCase().includes("animal");
}

function normalizeNcpReport(row, lookups) {
  const locationName = lookups.locations.get(row["Location"]);
  const matrixEntry = lookups.matrix.get(row["Matrix"]);
  const matrixName = matrixEntry?.name ?? "";
  const matrixCategoryName = matrixEntry?.categoryName ?? "";
  const animalName = isAnimalCategory(matrixCategoryName) ? matrixName : "";
  const contaminantName = lookups.contaminants.get(row["Contaminant"]);
  const years = [row["funding_start_year"], row["funding_end_year"]].filter(Boolean).join(" - ");

  return {
    type: "ncp-reports",
    typeLabel: "NCP Report",
    title: row["Project Title"] || "Untitled NCP report",
    summary: row["summary"] || "",
    url: row["URL"] || "",
    locationName,
    matrixName,
    animalName,
    contaminantName,
    meta: [row["Project Lead"], years, locationName, matrixName, contaminantName].filter(Boolean),
    searchFields: [
      row["Project Title"],
      row["Project Lead"],
      row["summary"],
      row["funding_start_year"],
      row["funding_end_year"],
      locationName,
      matrixName,
      contaminantName,
    ],
  };
}

function normalizePdc(row, lookups) {
  const locationName = lookups.locations.get(row["Location"]);

  return {
    type: "pdc",
    typeLabel: "PDC",
    title: row["Project Title"] || "Untitled PDC record",
    summary: "",
    url: row["Saved to Google"] || "",
    locationName,
    matrixName: "",
    animalName: "",
    contaminantName: "",
    meta: [row["Project Lead"], row["Year"], locationName].filter(Boolean),
    searchFields: [
      row["Project Title"],
      row["Project Lead"],
      row["Year"],
      locationName,
    ],
  };
}

function normalizePublication(row, lookups) {
  const locationName = lookups.locations.get(row["Location"]);
  const matrixEntry = lookups.matrix.get(row["Matrix _Animal Type"]);
  const matrixName = matrixEntry?.name ?? "";
  const matrixCategoryName = matrixEntry?.categoryName ?? "";
  const animalName = isAnimalCategory(matrixCategoryName) ? matrixName : "";
  const contaminantName = lookups.contaminants.get(row["Contaminants"]);
  const publicationType = lookups.publicationTypes.get(row["Publication type"]);

  return {
    type: "publications",
    typeLabel: "Publication",
    title: row["Title"] || "Untitled publication",
    summary: row["Abstract/Summary"] || "",
    url: row["URL"] || row["PDF saved to google"] || "",
    locationName,
    matrixName,
    animalName,
    contaminantName,
    meta: [row["Lead Authors"], row["Year"], publicationType, locationName, matrixName, contaminantName].filter(Boolean),
    searchFields: [
      row["Title"],
      row["Lead Authors"],
      row["Year"],
      row["Abstract/Summary"],
      publicationType,
      locationName,
      matrixName,
      contaminantName,
    ],
  };
}

function renderSearchMessage(kicker, title, copy) {
  const panel = document.querySelector(".search-results-panel");

  if (!panel) {
    return;
  }

  panel.innerHTML = `
    <div class="search-results-placeholder">
      <div class="search-results-placeholder-card">
        <p class="search-results-kicker">${escapeHtml(kicker)}</p>
        <h2 class="search-results-title">${escapeHtml(title)}</h2>
        <p class="search-results-copy">${escapeHtml(copy)}</p>
      </div>
    </div>
  `;
}

function renderSearchResults(results, query) {
  const panel = document.querySelector(".search-results-panel");

  if (!panel) {
    return;
  }

  if (!results.length) {
    renderSearchMessage("Search results", "No results found", `No records matched "${query}".`);
    return;
  }

  const resultMarkup = results
    .map((result) => {
      const titleMarkup = result.url
        ? `<a class="search-result-title-link" href="${escapeHtml(result.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(result.title)}</a>`
        : escapeHtml(result.title);
      const metaMarkup = result.meta.length
        ? `<p class="search-result-meta">${escapeHtml(result.meta.join(" | "))}</p>`
        : "";
      const summaryMarkup = result.summary
        ? `<p class="search-result-summary">${escapeHtml(result.summary)}</p>`
        : "";

      return `
        <article class="search-result-card">
          <p class="search-result-type">${escapeHtml(result.typeLabel)}</p>
          <h3 class="search-result-title">${titleMarkup}</h3>
          ${metaMarkup}
          ${summaryMarkup}
        </article>
      `;
    })
    .join("");

  panel.innerHTML = `
    <div class="search-results-list">
      <p class="search-results-count">${results.length} result${results.length === 1 ? "" : "s"} found for "${escapeHtml(query)}"</p>
      ${resultMarkup}
    </div>
  `;
}

function getSelectedContaminantFilter() {
  return document.querySelector('input[name="contaminant-filter"]:checked')?.value ?? "all";
}

function getSelectedLocationFilter() {
  return document.querySelector('input[name="location-filter"]:checked')?.value ?? "all";
}

function getSelectedAnimalFilter() {
  return document.querySelector('input[name="animal-filter"]:checked')?.value ?? "all";
}

function getFilteredSearchResults(results) {
  const selectedContaminant = getSelectedContaminantFilter();
  const selectedLocation = getSelectedLocationFilter();
  const selectedAnimal = getSelectedAnimalFilter();

  return results.filter((result) => {
    const contaminantMatches = selectedContaminant === "all" || result.contaminantName === selectedContaminant;
    const locationMatches = selectedLocation === "all" || result.locationName === selectedLocation;
    const animalMatches = selectedAnimal === "all" || result.animalName === selectedAnimal;

    return contaminantMatches && locationMatches && animalMatches;
  });
}

function renderDynamicResultFilter({ results, groupId, optionsId, radioName, fieldName, allLabel }) {
  const group = document.getElementById(groupId);
  const options = document.getElementById(optionsId);

  if (!group || !options) {
    return;
  }

  const valueCounts = new Map();

  results.forEach((result) => {
    const value = String(result[fieldName] ?? "").trim();

    if (!value || value.toLowerCase() === "null") {
      return;
    }

    valueCounts.set(value, (valueCounts.get(value) ?? 0) + 1);
  });

  if (valueCounts.size === 0) {
    group.hidden = true;
    options.innerHTML = "";
    return;
  }

  group.hidden = false;

  const sortedValues = [...valueCounts.entries()].sort(([first], [second]) => first.localeCompare(second));

  options.innerHTML = [
    `<label class="filter-radio">
      <input type="radio" name="${radioName}" value="all" checked>
      <span>${escapeHtml(allLabel)} (${results.length})</span>
    </label>`,
    ...sortedValues.map(([value, count]) => `
      <label class="filter-radio">
        <input type="radio" name="${radioName}" value="${escapeHtml(value)}">
        <span>${escapeHtml(value)} (${count})</span>
      </label>
    `),
  ].join("");

  options.querySelectorAll(`input[name="${radioName}"]`).forEach((input) => {
    input.addEventListener("change", () => {
      renderSearchResults(getFilteredSearchResults(currentSearchResults), currentSearchQuery);
    });
  });
}

function renderContaminantFilter(results) {
  renderDynamicResultFilter({
    results,
    groupId: "contaminant-filter-group",
    optionsId: "contaminant-filter-options",
    radioName: "contaminant-filter",
    fieldName: "contaminantName",
    allLabel: "All contaminants",
  });
}

function renderLocationFilter(results) {
  renderDynamicResultFilter({
    results,
    groupId: "location-filter-group",
    optionsId: "location-filter-options",
    radioName: "location-filter",
    fieldName: "locationName",
    allLabel: "All locations",
  });
}

function renderAnimalFilter(results) {
  renderDynamicResultFilter({
    results,
    groupId: "animal-filter-group",
    optionsId: "animal-filter-options",
    radioName: "animal-filter",
    fieldName: "animalName",
    allLabel: "All animals",
  });
}

function clearContaminantFilter() {
  const group = document.getElementById("contaminant-filter-group");
  const options = document.getElementById("contaminant-filter-options");

  if (group) {
    group.hidden = true;
  }

  if (options) {
    options.innerHTML = "";
  }
}

function clearLocationFilter() {
  const group = document.getElementById("location-filter-group");
  const options = document.getElementById("location-filter-options");

  if (group) {
    group.hidden = true;
  }

  if (options) {
    options.innerHTML = "";
  }
}

function clearAnimalFilter() {
  const group = document.getElementById("animal-filter-group");
  const options = document.getElementById("animal-filter-options");

  if (group) {
    group.hidden = true;
  }

  if (options) {
    options.innerHTML = "";
  }
}

function getSearchResultDedupeKey(result) {
  return `${result.type}:title:${result.title.trim().toLowerCase()}`;
}

function dedupeSearchResults(results) {
  const seenKeys = new Set();

  return results.filter((result) => {
    const dedupeKey = getSearchResultDedupeKey(result);

    if (seenKeys.has(dedupeKey)) {
      return false;
    }

    seenKeys.add(dedupeKey);
    return true;
  });
}

async function runSearchFromElements(elements) {
  const query = elements.searchInput?.value.trim() || getSearchQueryFromUrl();
  const resultType = getSelectedResultType();

  if (!query) {
    currentSearchResults = [];
    currentSearchQuery = "";
    clearContaminantFilter();
    clearLocationFilter();
    clearAnimalFilter();
    renderSearchMessage("Search results", "Enter a search term", "Use the search bar to search NCP Reports, Publications, and PDC records.");
    return;
  }

  renderSearchMessage("Searching", `Searching for "${query}"`, "Checking NCP Reports, Publications, and PDC records...");

  try {
    const lookups = await fetchLookupMaps();
    const tableRequests = [];

    if (resultType === "all" || resultType === "ncp-reports") {
      tableRequests.push(
        supabaseClient.from("NCP Reports").select("*").then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((row) => normalizeNcpReport(row, lookups));
        })
      );
    }

    if (resultType === "all" || resultType === "publications") {
      tableRequests.push(
        supabaseClient.from("Publications").select("*").then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((row) => normalizePublication(row, lookups));
        })
      );
    }

    if (resultType === "all" || resultType === "pdc") {
      tableRequests.push(
        supabaseClient.from("PDC").select("*").then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((row) => normalizePdc(row, lookups));
        })
      );
    }

    const groupedResults = await Promise.all(tableRequests);
    const results = groupedResults
      .flat()
      .filter((result) => searchableTextMatches(result.searchFields, query));
    const dedupedResults = dedupeSearchResults(results);

    currentSearchResults = dedupedResults;
    currentSearchQuery = query;
    renderContaminantFilter(dedupedResults);
    renderLocationFilter(dedupedResults);
    renderAnimalFilter(dedupedResults);
    renderSearchResults(getFilteredSearchResults(dedupedResults), query);
  } catch (error) {
    console.error("Search failed:", error);
    currentSearchResults = [];
    currentSearchQuery = "";
    clearContaminantFilter();
    clearLocationFilter();
    clearAnimalFilter();
    renderSearchMessage("Search error", "Could not run search", error.message);
  }
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
      return `<button class="location-card" type="button" data-location-query="${label}">${label}</button>`;
    })
    .join("");

  grid.querySelectorAll(".location-card").forEach((button) => {
    button.addEventListener("click", () => {
      const locationQuery = button.dataset.locationQuery ?? "";
      navigateToSearchWithQuery(locationQuery);
    });
  });
}

function renderContaminantStatus(message) {
  const grid = document.getElementById("contaminants-grid");

  if (!grid) {
    return;
  }

  grid.innerHTML = `<p class="contaminants-status-message">${message}</p>`;
}

function renderContaminants(contaminants) {
  const grid = document.getElementById("contaminants-grid");

  if (!grid) {
    return;
  }

  if (!Array.isArray(contaminants) || contaminants.length === 0) {
    renderContaminantStatus("No contaminants found.");
    return;
  }

  grid.innerHTML = contaminants
    .map((contaminant) => {
      const name = contaminant["Name"] ?? "Unnamed contaminant";
      const imageUrl = contaminant["image_url text"]?.trim();
      const infoUrl = contaminant["info_url"]?.trim();
      const imageMarkup = imageUrl
        ? `<img class="contaminant-card-image" src="${imageUrl}" alt="${name}">`
        : `<div class="contaminant-card-image-fallback">No image</div>`;
      const cardTag = infoUrl ? "a" : "article";
      const cardHref = infoUrl ? ` href="${infoUrl}" target="_blank" rel="noopener noreferrer"` : "";
      const clickableClass = infoUrl ? " contaminant-card-link" : "";

      return `
        <${cardTag} class="contaminant-card${clickableClass}"${cardHref}>
          <div class="contaminant-card-image-wrap">
            ${imageMarkup}
          </div>
          <p class="contaminant-card-label">${name}</p>
        </${cardTag}>
      `;
    })
    .join("");
}

function renderCategoryStatus(message) {
  const list = document.getElementById("categories-list");

  if (!list) {
    return;
  }

  list.innerHTML = `<p class="categories-status-message">${message}</p>`;
}

function renderCategories(categories, matrixEntries = []) {
  const list = document.getElementById("categories-list");

  if (!list) {
    return;
  }

  if (!Array.isArray(categories) || categories.length === 0) {
    renderCategoryStatus("No categories found.");
    return;
  }

  list.innerHTML = categories
    .map((category) => {
      const label = category["Categories"] ?? "Unnamed category";
      const categoryId = category["id"];
      const categoryEntries = matrixEntries.filter((entry) => entry["category"] === categoryId);
      const entryMarkup = categoryEntries.length
        ? categoryEntries
            .map((entry) => {
              const entryName = entry["Name"] ?? "Unnamed entry";
              const searchUrl = new URL("search.html", window.location.href);
              searchUrl.searchParams.set("q", entryName);

              return `<a class="category-matrix-link" href="${searchUrl.toString()}">${entryName}</a>`;
            })
            .join("")
        : `<p class="category-empty-message">No entries in this category yet.</p>`;

      return `
        <section class="category-group">
          <h3 class="category-subtitle">${label}</h3>
          <div class="category-matrix-list">
            ${entryMarkup}
          </div>
        </section>
      `;
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

async function initializeContaminantsPage() {
  const grid = document.getElementById("contaminants-grid");

  if (!grid) {
    return;
  }

  supabaseClient = initializeSupabase();

  if (!supabaseClient) {
    renderContaminantStatus("Supabase is not configured yet.");
    return;
  }

  renderContaminantStatus("Loading contaminants...");

  const { data, error } = await supabaseClient
    .from("Contaminants")
    .select("*")
    .order("Name", { ascending: true });

  if (error) {
    console.error("Failed to load contaminants:", error);
    renderContaminantStatus(`Could not load contaminants: ${error.message}`);
    return;
  }

  renderContaminants(data);
}

async function initializeCategoriesPage() {
  const list = document.getElementById("categories-list");

  if (!list) {
    return;
  }

  supabaseClient = initializeSupabase();

  if (!supabaseClient) {
    renderCategoryStatus("Supabase is not configured yet.");
    return;
  }

  renderCategoryStatus("Loading categories...");

  const { data: categories, error: categoriesError } = await supabaseClient
    .from("Matrix Categories")
    .select("*")
    .order("Categories", { ascending: true });

  if (categoriesError) {
    console.error("Failed to load categories:", categoriesError);
    renderCategoryStatus(`Could not load categories: ${categoriesError.message}`);
    return;
  }

  const { data: matrixEntries, error: matrixError } = await supabaseClient
    .from("Matrix")
    .select("*")
    .order("Name", { ascending: true });

  if (matrixError) {
    console.error("Failed to load matrix entries:", matrixError);
    renderCategoryStatus(`Could not load category entries: ${matrixError.message}`);
    return;
  }

  renderCategories(categories, matrixEntries);
}

function initializeApp() {
  initializeLandingPage();
  initializeSearchPage();
  initializeLocationsPage();
  initializeContaminantsPage();
  initializeCategoriesPage();
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
