const loginCard = document.getElementById("loginCard");
const analyticsCard = document.getElementById("analyticsCard");
const logsCard = document.getElementById("logsCard");
const loginForm = document.getElementById("loginForm");
const filtersForm = document.getElementById("filtersForm");
const logsBody = document.getElementById("logsBody");
const statusEl = document.getElementById("status");
const metaEl = document.getElementById("meta");
const logoutBtn = document.getElementById("logoutBtn");
const navAnalyticsBtn = document.getElementById("navAnalytics");
const navLogsBtn = document.getElementById("navLogs");
const analyticsPeriodSelect = document.getElementById("analyticsPeriod");
const refreshAnalyticsBtn = document.getElementById("refreshAnalytics");

let currentTab = "analytics";

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#b91c1c" : "#0f766e";
}

function showTab(tab) {
  currentTab = tab;
  const isAnalytics = tab === "analytics";
  
  analyticsCard.classList.toggle("hidden", !isAnalytics);
  logsCard.classList.toggle("hidden", isAnalytics);
  
  navAnalyticsBtn.classList.toggle("active", isAnalytics);
  navLogsBtn.classList.toggle("active", !isAnalytics);
  
  if (isAnalytics) {
    loadAnalytics();
  }
}

function showLoggedInUi(loggedIn) {
  loginCard.classList.toggle("hidden", loggedIn);
  analyticsCard.classList.toggle("hidden", !loggedIn);
  logsCard.classList.toggle("hidden", !loggedIn || currentTab !== "logs");
  logoutBtn.classList.toggle("hidden", !loggedIn);
  navAnalyticsBtn.classList.toggle("hidden", !loggedIn);
  navLogsBtn.classList.toggle("hidden", !loggedIn);
  
  if (loggedIn) {
    showTab("analytics");
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function renderDataTable(data, columns) {
  if (!data || data.length === 0) {
    return "<p style='color: #9aa5b1;'>No data available</p>";
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  // Header
  const headerRow = document.createElement("tr");
  for (const col of columns) {
    const th = document.createElement("th");
    th.textContent = col.header;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);

  // Rows
  for (const item of data) {
    const row = document.createElement("tr");
    for (const col of columns) {
      const td = document.createElement("td");
      const value = col.render ? col.render(item) : item[col.key];
      td.innerHTML = value;
      row.appendChild(td);
    }
    tbody.appendChild(row);
  }

  table.appendChild(thead);
  table.appendChild(tbody);
  
  const wrapper = document.createElement("div");
  wrapper.className = "data-table";
  wrapper.appendChild(table);
  return wrapper;
}

async function loadAnalytics() {
  try {
    const sinceHours = analyticsPeriodSelect.value;
    const response = await fetch(`/api/admin/analytics?sinceHours=${sinceHours}`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to load analytics");
    }

    const data = await response.json();
    
    // Update metrics
    document.getElementById("totalQuotesValue").textContent = data.totalQuotes.toLocaleString();
    document.getElementById("totalRevenueValue").textContent = formatCurrency(data.totalRevenue);
    
    const avgQuote = data.totalQuotes > 0 ? data.totalRevenue / data.totalQuotes : 0;
    document.getElementById("avgQuoteValue").textContent = formatCurrency(avgQuote);

    // Top Services
    const servicesContainer = document.getElementById("topServicesContainer");
    const servicesTable = renderDataTable(data.topServices, [
      { header: "Service", key: "name" },
      { header: "Requests", key: "count", render: (item) => `<span class="count-badge">${item.count}</span>` },
      { header: "Revenue", key: "revenue", render: (item) => `<span class="revenue-badge">${formatCurrency(item.revenue)}</span>` },
    ]);
    servicesContainer.innerHTML = "";
    servicesContainer.appendChild(servicesTable);

    // Top Combinations
    const combinationsContainer = document.getElementById("topCombinationsContainer");
    const combinationsTable = renderDataTable(data.topCombinations, [
      { header: "Vehicle | Dirt Level | Goal", key: "name" },
      { header: "Count", key: "count", render: (item) => `<span class="count-badge">${item.count}</span>` },
    ]);
    combinationsContainer.innerHTML = "";
    combinationsContainer.appendChild(combinationsTable);

    // Vehicles
    const vehiclesContainer = document.getElementById("topVehiclesContainer");
    const vehiclesTable = renderDataTable(data.topVehicles, [
      { header: "Vehicle", key: "name" },
      { header: "Count", key: "count", render: (item) => `<span class="count-badge">${item.count}</span>` },
    ]);
    vehiclesContainer.innerHTML = "";
    vehiclesContainer.appendChild(vehiclesTable);

    // Goals
    const goalsContainer = document.getElementById("topGoalsContainer");
    const goalsTable = renderDataTable(data.topGoals, [
      { header: "Goal", key: "name" },
      { header: "Count", key: "count", render: (item) => `<span class="count-badge">${item.count}</span>` },
    ]);
    goalsContainer.innerHTML = "";
    goalsContainer.appendChild(goalsTable);

    // Dirt Levels
    const dirtContainer = document.getElementById("topDirtLevelsContainer");
    const dirtTable = renderDataTable(data.topDirtLevels, [
      { header: "Dirt Level", key: "name" },
      { header: "Count", key: "count", render: (item) => `<span class="count-badge">${item.count}</span>` },
    ]);
    dirtContainer.innerHTML = "";
    dirtContainer.appendChild(dirtTable);

    setStatus("Analytics updated.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function loadLogs() {
  const formData = new FormData(filtersForm);
  const params = new URLSearchParams();

  for (const [key, value] of formData.entries()) {
    if (String(value || "").trim()) {
      params.set(key, String(value));
    }
  }

  const response = await fetch(`/api/admin/logs?${params.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to load logs");
  }

  const data = await response.json();
  metaEl.textContent = `Showing ${data.count} logs. Retention: ${data.retentionDays} days.`;

  logsBody.innerHTML = "";
  for (const item of data.logs || []) {
    const row = document.createElement("tr");
    const info = item.payload
      ? JSON.stringify(item.payload)
      : JSON.stringify({
          method: item.method,
          status: item.status,
          durationMs: item.durationMs,
          ip: item.ip,
        });

    row.innerHTML = `
      <td>${item.ts || ""}</td>
      <td>${item.type || ""}</td>
      <td>${item.path || ""}</td>
      <td>${info}</td>
    `;
    logsBody.appendChild(row);
  }
}

// Tab navigation
navAnalyticsBtn.addEventListener("click", () => showTab("analytics"));
navLogsBtn.addEventListener("click", () => showTab("logs"));

// Analytics
refreshAnalyticsBtn.addEventListener("click", loadAnalytics);
analyticsPeriodSelect.addEventListener("change", loadAnalytics);

// Login
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Login failed");
    }

    showLoggedInUi(true);
    setStatus(`Signed in as ${data.email}`);
  } catch (error) {
    setStatus(error.message, true);
  }
});

// Logs filters
filtersForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await loadLogs();
    setStatus("Logs refreshed.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  try {
    await fetch("/api/admin/logout", {
      method: "POST",
      credentials: "include",
    });
  } finally {
    showLoggedInUi(false);
    logsBody.innerHTML = "";
    metaEl.textContent = "";
    setStatus("Logged out.");
  }
});

// Init
(async function init() {
  try {
    const response = await fetch("/api/admin/me", { credentials: "include" });
    if (!response.ok) {
      showLoggedInUi(false);
      return;
    }

    showLoggedInUi(true);
    setStatus("Admin session active.");
  } catch {
    showLoggedInUi(false);
  }
})();
