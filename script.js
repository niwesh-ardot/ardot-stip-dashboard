/* GLOBAL STATE */
const state = {
  projects: [],      // from stip_projects.csv
  funding: [],       // from Funding.csv
  revenue: [],       // from Revenue.csv
  filters: {
    district: "ALL",
    ffy: "ALL",
    workType: "ALL",
    county: "ALL",
    job: "",
    search: ""
  }
};

/* CHARTS INSTANCES */
const charts = {};

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  loadAllData();
});

/* --- 1. DATA LOADING --- */
function loadAllData() {
  Promise.all([
    fetch("data/stip_projects.csv").then(r => r.text()),
    fetch("data/Funding.csv").then(r => r.text()),
    fetch("data/Revenue.csv").then(r => r.text())
  ])
    .then(([stipText, fundingText, revenueText]) => {
      // Parse STIP Projects
      const stipParsed = Papa.parse(stipText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
      });
      state.projects = stipParsed.data.map(processStipRow);

      // Parse Funding
      const fundParsed = Papa.parse(fundingText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
      });
      state.funding = fundParsed.data;

      // Parse Revenue
      const revParsed = Papa.parse(revenueText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
      });
      state.revenue = revParsed.data;

      // Init Views
      initStipView();
      initFundingView();
      initRevenueView();
    })
    .catch(err => console.error("Error loading CSVs:", err));
}

/* --- 2. NAVIGATION --- */
function initNavigation() {
  const buttons = document.querySelectorAll(".nav-btn");
  const sections = document.querySelectorAll(".view-section");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      // Toggle Buttons
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Toggle Sections
      const viewId = `view-${btn.dataset.view}`;
      sections.forEach(sec => sec.classList.remove("active"));
      document.getElementById(viewId).classList.add("active");
    });
  });
}

/* =========================================
   VIEW 1: STIP PROJECTS LOGIC
   ========================================= */

// Normalize row keys by collapsing whitespace/newlines so CSV headers with line breaks still match
function normalizeRowKeys(row) {
  const normalized = {};
  Object.entries(row || {}).forEach(([key, val]) => {
    if (!key) return;
    const cleanKey = String(key).replace(/\s+/g, " ").trim();
    normalized[cleanKey] = val;
  });
  return normalized;
}

// Replace common non-ASCII dashes and stray characters to keep table text clean
function cleanText(str) {
  if (str == null) return "";
  return String(str)
    .replace(/[\u2010-\u2015]/g, "-") // various dash chars to hyphen
    .replace(/[^\x00-\x7F]/g, " ")    // drop other non-ASCII
    .replace(/\s+/g, " ")
    .trim();
}

function processStipRow(row) {
  const r = normalizeRowKeys(row);
  // Helper to safely parse money string "$1,000" to number 1000
  const parseCost = val => {
    if (typeof val === "number") return val;
    if (!val) return 0;
    return parseFloat(val.replace(/[$,]/g, "")) || 0;
  };

  return {
    job: cleanText(r["STATE JOB NUMBER"] || r["Job #"] || ""),
    termini: cleanText(r["TERMINI"] || ""),
    district: cleanText(r["ARDOT DISTRICT"] || r["District"] || ""),
    county: cleanText(r["COUNTY"] || ""),
    route: r["ROUTE"] || "",
    ffy: String(r["FFY"] || ""),
    workType: cleanText(r["TYPE OF WORK"] || ""),
    length: parseFloat(r["LENGTH"]) || 0,
    // Costs in source file are in thousands; convert to whole dollars
    cost: parseCost(r["TOTAL COST"]) * 1000
  };
}

function initStipView() {
  populateFilters();
  updateStipDashboard();

  // Event Listeners for Filters
  ["districtFilter", "ffyFilter", "workTypeFilter", "countyFilter"].forEach(
    id => {
      document.getElementById(id).addEventListener("change", updateStipDashboard);
    }
  );
  const jobFilter = document.getElementById("jobFilter");
  if (jobFilter) {
    jobFilter.addEventListener("input", updateStipDashboard);
  }
  document
    .getElementById("searchInput")
    .addEventListener("input", updateStipDashboard);
  document
    .getElementById("resetFiltersBtn")
    .addEventListener("click", resetFilters);
  document
    .getElementById("downloadCsvBtn")
    .addEventListener("click", downloadStipCSV);
}

function getFilteredProjects() {
  const f = state.filters;
  // Read DOM values
  f.district = document.getElementById("districtFilter").value;
  f.ffy = document.getElementById("ffyFilter").value;
  f.workType = document.getElementById("workTypeFilter").value;
  f.county = document.getElementById("countyFilter").value;
  f.job = (document.getElementById("jobFilter").value || "").toLowerCase();
  f.search = document.getElementById("searchInput").value.toLowerCase();

  return state.projects.filter(p => {
    if (f.district !== "ALL" && p.district !== f.district) return false;
    if (f.ffy !== "ALL" && p.ffy !== f.ffy) return false;
    if (f.workType !== "ALL" && p.workType !== f.workType) return false;
    if (f.county !== "ALL" && p.county !== f.county) return false;
    if (f.job && !String(p.job || "").toLowerCase().includes(f.job)) return false;
    if (f.search) {
      const searchStr = `${p.job} ${p.termini} ${p.route}`.toLowerCase();
      if (!searchStr.includes(f.search)) return false;
    }
    return true;
  });
}

function updateStipDashboard() {
  const data = getFilteredProjects();

  // KPIs
  const totalCost = data.reduce((sum, p) => sum + p.cost, 0);
  const totalMiles = data.reduce((sum, p) => sum + p.length, 0);

  renderKPIs("stipSummaryGrid", [
    { label: "Projects", value: data.length },
    { label: "Total Cost", value: formatMoney(totalCost) },
    { label: "Total Miles", value: totalMiles.toFixed(1) + " mi" },
    {
      label: "Avg Cost",
      value: formatMoney(data.length ? totalCost / data.length : 0)
    }
  ]);

  // Charts
  renderProjectsByWorkType(data);
  renderCostByYear(data);

  // Table
  renderTable(data);
}

function populateFilters() {
  const populate = (id, key) => {
    const unique = [...new Set(state.projects.map(p => p[key]).filter(Boolean))].sort();
    const sel = document.getElementById(id);
    sel.innerHTML = '<option value="ALL">All</option>';
    unique.forEach(
      v => (sel.innerHTML += `<option value="${v}">${v}</option>`)
    );
  };
  populate("districtFilter", "district");
  populate("ffyFilter", "ffy");
  populate("workTypeFilter", "workType");
  populate("countyFilter", "county");
}

function resetFilters() {
  document.querySelectorAll(".filters select").forEach(s => (s.value = "ALL"));
  const jobFilter = document.getElementById("jobFilter");
  if (jobFilter) jobFilter.value = "";
  document.getElementById("searchInput").value = "";
  updateStipDashboard();
}

/* Small helper to populate year dropdowns in Funding & Revenue views */
function populateYearFilter(selectId, years) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = `<option value="ALL">All (${years[0]}–${years[years.length - 1]})</option>`;
  years.forEach(y => {
    sel.innerHTML += `<option value="${y}">${y}</option>`;
  });
}

/* =========================================
   VIEW 2: FUNDING ANALYSIS LOGIC
   ========================================= */

function initFundingView() {
  const years = [2025, 2026, 2027, 2028];
  populateYearFilter("fundingYearFilter", years);

  const yearSelect = document.getElementById("fundingYearFilter");
  if (yearSelect) {
    yearSelect.addEventListener("change", updateFundingDashboard);
  }

  updateFundingDashboard();
}

function updateFundingDashboard() {
  const data = state.funding;
  if (!data || !data.length) return;

  const years = [2025, 2026, 2027, 2028];
  const yearSelect = document.getElementById("fundingYearFilter");
  const selectedYear = yearSelect ? yearSelect.value : "ALL";

  const yearlyAvail = {};
  const yearlySched = {};
  const compByYear = {};
  const federalCatByYear = {};
  const nonFederalCatByYear = {};

  years.forEach(y => {
    yearlyAvail[y] = 0;
    yearlySched[y] = 0;
    compByYear[y] = { Federal: 0, "Non-Federal": 0 };
    federalCatByYear[y] = {};
    nonFederalCatByYear[y] = {};
  });

  data.forEach(row => {
    const type = row["Funding Type"] || "Other";
    const typeNorm = String(type).trim().toLowerCase();
    const category = row["Category"] || "Other";

    years.forEach(y => {
      const avail = parseFloat(row[`${y} Available`]) || 0;
      const sched = parseFloat(row[`${y} Scheduled`]) || 0;

      yearlyAvail[y] += avail;
      yearlySched[y] += sched;

      const isFederal = typeNorm.startsWith("federal");
      const bucket = isFederal ? "Federal" : "Non-Federal";

      compByYear[y][bucket] += avail;

      if (bucket === "Federal") {
        if (!federalCatByYear[y][category]) federalCatByYear[y][category] = 0;
        federalCatByYear[y][category] += avail;
      } else {
        if (!nonFederalCatByYear[y][category]) nonFederalCatByYear[y][category] = 0;
        nonFederalCatByYear[y][category] += avail;
      }
    });
  });

  const yearsToUse =
    selectedYear === "ALL" ? years : [parseInt(selectedYear, 10)];

  let totalAvail = 0;
  let totalSched = 0;
  const compTotals = { Federal: 0, "Non-Federal": 0 };
  const federalCategoryTotals = {};
  const nonFederalCategoryTotals = {};

  yearsToUse.forEach(y => {
    totalAvail += yearlyAvail[y];
    totalSched += yearlySched[y];
    compTotals.Federal += compByYear[y].Federal;
    compTotals["Non-Federal"] += compByYear[y]["Non-Federal"];

    Object.entries(federalCatByYear[y]).forEach(([cat, val]) => {
      federalCategoryTotals[cat] = (federalCategoryTotals[cat] || 0) + val;
    });
    Object.entries(nonFederalCatByYear[y]).forEach(([cat, val]) => {
      nonFederalCategoryTotals[cat] = (nonFederalCategoryTotals[cat] || 0) + val;
    });
  });

  const utilization = totalAvail
    ? ((totalSched / totalAvail) * 100).toFixed(1) + "%"
    : "0%";
  const federalShare = totalAvail
    ? ((compTotals.Federal / totalAvail) * 100).toFixed(0) + "%"
    : "0%";
  const nonFederalShare = totalAvail
    ? ((compTotals["Non-Federal"] / totalAvail) * 100).toFixed(0) + "%"
    : "0%";

  const kpiPrefix = selectedYear === "ALL" ? "4-Year" : selectedYear;

  renderKPIs("fundingSummaryGrid", [
    {
      label: `${kpiPrefix} Available`,
      value: `$${(totalAvail / 1000).toFixed(1)}B`,
      sub: "Total Budget"
    },
    {
      label: `${kpiPrefix} Scheduled`,
      value: `$${(totalSched / 1000).toFixed(1)}B`,
      sub: "Programmed Projects"
    },
    {
      label: "Utilization",
      value: utilization,
      sub: "Scheduled vs Available"
    },
    {
      label: "Federal Share",
      value: federalShare,
      sub: "Of Total Funding"
    },
    {
      label: "Non-Federal Share",
      value: nonFederalShare,
      sub: "Of Total Funding"
    }
  ]);

  const labels = yearsToUse;
  const availValues = labels.map(y => yearlyAvail[y]);
  const schedValues = labels.map(y => yearlySched[y]);

  destroyChart("fundingBalanceChart");
  const ctxBal = document
    .getElementById("fundingBalanceChart")
    .getContext("2d");
  charts["fundingBalanceChart"] = new Chart(ctxBal, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Available",
          data: availValues,
          backgroundColor: vividColors[2]
        },
        {
          label: "Scheduled",
          data: schedValues,
          backgroundColor: vividColors[0]
        }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  destroyChart("fundingCompositionChart");
  const ctxComp = document
    .getElementById("fundingCompositionChart")
    .getContext("2d");
  charts["fundingCompositionChart"] = new Chart(ctxComp, {
    type: "doughnut",
    data: {
      labels: Object.keys(compTotals),
      datasets: [
        {
          data: Object.values(compTotals),
          backgroundColor: [vividColors[0], vividColors[9]]
        }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  destroyChart("federalCategoryChart");
  const ctxFedCat = document
    .getElementById("federalCategoryChart")
    .getContext("2d");
  charts["federalCategoryChart"] = new Chart(ctxFedCat, {
    type: "bar",
    data: {
      labels: Object.keys(federalCategoryTotals),
      datasets: [
        {
          label: "Federal Available",
          data: Object.values(federalCategoryTotals),
          backgroundColor: vividColors[0],
          borderRadius: 6,
          maxBarThickness: 60
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          title: { display: true, text: "Available ($M)" },
          ticks: {
            callback: value => `${value.toLocaleString()}M`
          },
          grid: { drawBorder: false }
        },
        x: { grid: { display: false } }
      }
    }
  });

  destroyChart("nonFederalCategoryChart");
  const ctxNonFedCat = document
    .getElementById("nonFederalCategoryChart")
    .getContext("2d");
  charts["nonFederalCategoryChart"] = new Chart(ctxNonFedCat, {
    type: "bar",
    data: {
      labels: Object.keys(nonFederalCategoryTotals),
      datasets: [
        {
          label: "Non-Federal Available",
          data: Object.values(nonFederalCategoryTotals),
          backgroundColor: vividColors[9],
          borderRadius: 6,
          maxBarThickness: 60
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          title: { display: true, text: "Available ($M)" },
          ticks: {
            callback: value => `${value.toLocaleString()}M`
          },
          grid: { drawBorder: false }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

/* =========================================
   GLOBAL COLOR PALETTE
   ========================================= */
const vividColors = [
  "#2563eb",
  "#3b82f6",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#a855f7",
  "#d946ef",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#84cc16"
];

/* =========================================
   VIEW 3: STATE REVENUE LOGIC
   ========================================= */

function initRevenueView() {
  const years = [2025, 2026, 2027, 2028];
  populateYearFilter("revenueYearFilter", years);

  const yearSelect = document.getElementById("revenueYearFilter");
  if (yearSelect) {
    yearSelect.addEventListener("change", updateRevenueDashboard);
  }

  updateRevenueDashboard();
}

function updateRevenueDashboard() {
  const data = state.revenue;
  if (!data || !data.length) return;

  const years = [2025, 2026, 2027, 2028];
  const yearSelect = document.getElementById("revenueYearFilter");
  const selectedYear = yearSelect ? yearSelect.value : "ALL";

  const yearlyTotal = {};
  const sourceTotalsByYear = {};

  years.forEach(y => {
    yearlyTotal[y] = 0;
    sourceTotalsByYear[y] = {};
  });

  data.forEach(row => {
    const type = row["Revenue Type"];
    if (!type) return;

    years.forEach(y => {
      const val = parseFloat(row[y]) || 0;
      yearlyTotal[y] += val;

      if (!sourceTotalsByYear[y][type]) {
        sourceTotalsByYear[y][type] = 0;
      }
      sourceTotalsByYear[y][type] += val;
    });
  });

  const yearsToUse =
    selectedYear === "ALL" ? years : [parseInt(selectedYear, 10)];

  const totalRev = yearsToUse.reduce(
    (sum, y) => sum + yearlyTotal[y],
    0
  );
  const avgRev = yearsToUse.length ? totalRev / yearsToUse.length : 0;

  const firstYear = yearsToUse[0];
  const lastYear = yearsToUse[yearsToUse.length - 1];

  renderKPIs("revenueSummaryGrid", [
    {
      label:
        selectedYear === "ALL"
          ? "Total Revenue (4yr)"
          : `Total Revenue (${selectedYear})`,
      value: `$${(totalRev / 1000).toFixed(2)}B`
    },
    {
      label: "Avg Annual Revenue",
      value: `$${avgRev.toFixed(1)}M`
    },
    {
      label: `${firstYear} Estimate`,
      value: `$${yearlyTotal[firstYear].toFixed(1)}M`
    },
    {
      label: `${lastYear} Projection`,
      value: `$${yearlyTotal[lastYear].toFixed(1)}M`
    }
  ]);

  // Trend line for selected range
  const trendLabels = yearsToUse;
  const trendValues = trendLabels.map(y => yearlyTotal[y]);

  destroyChart("revenueTrendChart");
  const ctxTrend = document
    .getElementById("revenueTrendChart")
    .getContext("2d");
  charts["revenueTrendChart"] = new Chart(ctxTrend, {
    type: "bar",
    data: {
      labels: trendLabels,
      datasets: [
        {
          label: "Total State Revenue",
          data: trendValues,
          backgroundColor: vividColors[0],
          borderColor: "#1e3a8a",
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 50
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          title: {
            display: true,
            text: "Revenue (in million)"
          },
          ticks: {
            callback: value => `${value.toLocaleString()}M`
          },
          grid: { drawBorder: false, color: "rgba(0,0,0,0.05)" }
        },
        x: { grid: { display: false } }
      }
    }
  });

  // Revenue mix (pie) for selected year(s)
  const combinedSourceTotals = {};
  yearsToUse.forEach(y => {
    Object.entries(sourceTotalsByYear[y]).forEach(([type, val]) => {
      combinedSourceTotals[type] =
        (combinedSourceTotals[type] || 0) + val;
    });
  });

  const sortedSources = Object.entries(combinedSourceTotals).sort(
    (a, b) => b[1] - a[1]
  );

  destroyChart("revenuePieChart");
  const ctxPie = document
    .getElementById("revenuePieChart")
    .getContext("2d");
  charts["revenuePieChart"] = new Chart(ctxPie, {
    type: "pie",
    data: {
      labels: sortedSources.map(x => x[0]),
      datasets: [
        {
          data: sortedSources.map(x => x[1]),
          backgroundColor: vividColors.slice(0, sortedSources.length),
          borderColor: "#ffffff",
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "right" } }
    }
  });
}

/* =========================================
   HELPER FUNCTIONS
   ========================================= */

function renderKPIs(containerId, items) {
  const container = document.getElementById(containerId);
  container.innerHTML = items
    .map(
      item => `
    <div class="summary-item">
      <div class="summary-label">${item.label}</div>
      <div class="summary-value">${item.value}</div>
      ${item.sub ? `<div class="summary-sub">${item.sub}</div>` : ""}
    </div>
  `
    )
    .join("");
}

function renderTable(data) {
  const tbody = document.getElementById("projectTableBody");
  const subset = data.slice(0, 500);

  tbody.innerHTML = subset
    .map(
      p => `
    <tr>
      <td>${p.job}</td>
      <td title="${p.termini}">${p.termini.substring(0, 30)}${
        p.termini.length > 30 ? "..." : ""
      }</td>
      <td><span class="pill">${p.district}</span></td>
      <td>${p.county}</td>
      <td>${p.route}</td>
      <td>${p.ffy}</td>
      <td>${p.workType}</td>
      <td>${p.length.toFixed(2)}</td>
      <td>${formatMoney(p.cost)}</td>
    </tr>
  `
    )
    .join("");
}

function renderProjectsByWorkType(data) {
  const counts = {};
  data.forEach(p => (counts[p.workType] = (counts[p.workType] || 0) + 1));
  const labels = Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 8);
  const values = labels.map(k => counts[k]);

  destroyChart("projectsByWorkTypeChart");
  const ctx = document
    .getElementById("projectsByWorkTypeChart")
    .getContext("2d");
  charts["projectsByWorkTypeChart"] = new Chart(ctx, {
    type: "bar",
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    },
    data: {
      labels: labels,
      datasets: [
        {
          data: values,
          backgroundColor: vividColors.slice(0, labels.length)
        }
      ]
    }
  });
}

function renderCostByYear(data) {
  const agg = {};
  data.forEach(p => (agg[p.ffy] = (agg[p.ffy] || 0) + p.cost));
  const years = Object.keys(agg)
    .filter(y => y !== "" && y != null)
    .sort((a, b) => Number(a) - Number(b));
  // Convert to millions for display
  const values = years.map(y => agg[y] / 1_000_000);
  const maxVal = Math.max(...values, 0);
  const suggestedMax = Math.ceil((maxVal + 100) / 100) * 100; // round to next 100M for headroom

  destroyChart("costByYearLineChart");
  const ctx = document
    .getElementById("costByYearLineChart")
    .getContext("2d");
  charts["costByYearLineChart"] = new Chart(ctx, {
    type: "bar",
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax,
          ticks: {
            callback: value => `${value}M`
          }
        },
        x: {
          offset: true,
          grid: { display: false, offset: true }
        }
      }
    },
    data: {
      labels: years,
      datasets: [
        {
          label: "Cost ($M)",
          data: values,
          backgroundColor: vividColors[2],
          borderRadius: 6,
          maxBarThickness: 60,
          categoryPercentage: 0.8,
          barPercentage: 0.8
        }
      ]
    }
  });
}

function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    charts[id] = null;
  }
}

function formatMoney(num) {
  if (num >= 1000000) return "$" + (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return "$" + (num / 1000).toFixed(0) + "K";
  return "$" + num.toFixed(0);
}

function downloadStipCSV() {
  const data = getFilteredProjects();
  if (!data.length) return alert("No data");
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("download", "filtered_stip.csv");
  a.click();
}
