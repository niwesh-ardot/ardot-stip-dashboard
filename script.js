let projectData = [];

const filters = {
  district: "ALL",
  ffy: "ALL",
  workType: "ALL",
  county: "ALL",
  search: ""
};

let costByYearLineChart = null;
let projectsByWorkTypeChart = null;
let fundingProgramsChart = null;

// DOM elements
let districtFilterEl;
let ffyFilterEl;
let workTypeFilterEl;
let countyFilterEl;
let searchInputEl;
let resetFiltersBtn;
let downloadCsvBtn;
let summaryGridEl;
let activeFilterLabelEl;
let tableBodyEl;
let tableCountLabelEl;

// Funding program config
const FUNDING_PROGRAMS = [
  // Federal
  { prop: "nhppK",          label: "NHPP",              category: "federal" },
  { prop: "nhfpK",          label: "NHFP",              category: "federal" },
  { prop: "hsipK",          label: "HSIP",              category: "federal" },
  { prop: "railHwyK",       label: "RAIL-HWY",          category: "federal" },
  { prop: "earmarkK",       label: "EARMARK",           category: "federal" },
  { prop: "stbgpK",         label: "STBGP",             category: "federal" },
  { prop: "stbgpBroffK",    label: "STBGP (BR OFF)",    category: "federal" },
  { prop: "stbgpGt200K",    label: "STBGP (GT 200K)",   category: "federal" },
  { prop: "bfpK",           label: "BFP",               category: "federal" },
  { prop: "bfpBroffK",      label: "BFP (BR OFF)",      category: "federal" },
  { prop: "nevfpK",         label: "NEVFP",             category: "federal" },
  { prop: "crpFlexK",       label: "CRP (FLEX)",        category: "federal" },
  { prop: "crpGt200K",      label: "CRP (GT 200K)",     category: "federal" },
  { prop: "protectK",       label: "PROTECT",           category: "federal" },
  { prop: "acK",            label: "AC",                category: "federal" },
  { prop: "recTrailsK",     label: "REC. TRAILS",       category: "federal" },
  { prop: "cmaqFlexK",      label: "CMAQ (FLEX)",       category: "federal" },
  { prop: "cmaqAqK",        label: "CMAQ (AQ)",         category: "federal" },
  { prop: "tapK",           label: "TAP",               category: "federal" },
  { prop: "tapGt200K",      label: "TAP (GT 200K)",     category: "federal" },
  { prop: "chbpK",          label: "CHBP",              category: "federal" },
  { prop: "infraK",         label: "INFRA",             category: "federal" },
  { prop: "raiseK",         label: "RAISE",             category: "federal" },
  { prop: "covidK",         label: "COVID",             category: "federal" },
  { prop: "flapK",          label: "FLAP",              category: "federal" },
  { prop: "fltpK",          label: "FLTP",              category: "federal" },
  { prop: "erfoK",          label: "ERFO",              category: "federal" },
  { prop: "ferryBoatK",     label: "FERRY BOAT",        category: "federal" },
  { prop: "dbeK",           label: "DBE",               category: "federal" },
  { prop: "ojtK",           label: "OJT",               category: "federal" },
  { prop: "mataK",          label: "MATA",              category: "federal" },
  { prop: "gapK",           label: "GAP",               category: "federal" },

  // State & local
  { prop: "marineFuelTaxK", label: "MARINE FUEL TAX",   category: "stateLocal" },
  { prop: "capK",           label: "CAP",               category: "stateLocal" },
  { prop: "amendment101K",  label: "AMENDMENT 101",     category: "stateLocal" },
  { prop: "stateK",         label: "STATE",             category: "stateLocal" },
  { prop: "act416K",        label: "ACT 416",           category: "stateLocal" },
  { prop: "stateLocalK",    label: "STATE-LOCAL",       category: "stateLocal" },
  { prop: "localK",         label: "LOCAL",             category: "stateLocal" }
];

document.addEventListener("DOMContentLoaded", () => {
  // Grab elements
  districtFilterEl = document.getElementById("districtFilter");
  ffyFilterEl = document.getElementById("ffyFilter");
  workTypeFilterEl = document.getElementById("workTypeFilter");
  countyFilterEl = document.getElementById("countyFilter");
  searchInputEl = document.getElementById("searchInput");
  resetFiltersBtn = document.getElementById("resetFiltersBtn");
  downloadCsvBtn = document.getElementById("downloadCsvBtn");
  summaryGridEl = document.getElementById("summaryGrid");
  activeFilterLabelEl = document.getElementById("activeFilterLabel");
  tableBodyEl = document.getElementById("projectTableBody");
  tableCountLabelEl = document.getElementById("tableCountLabel");

  // Load CSV
  fetch("data/stip_projects.csv")
    .then(resp => resp.text())
    .then(text => {
      const parsed = Papa.parse(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      });

      projectData = parsed.data.map(buildProjectFromRow);

      initFilters();
      initCharts();
      updateDashboard();
      attachEvents();
    })
    .catch(err => {
      console.error("Error loading CSV:", err);
      alert("Could not load data/stip_projects.csv. Check the file name and path.");
    });
});

/* ---------- Row mapping helpers ---------- */

function getRowValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return "";
}

function parseFunding(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/\$/g, "").replace(/,/g, "").trim();
    if (!cleaned || cleaned === "-" || cleaned === "$-") return 0;
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function parseMpoFlag(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const t = value.toLowerCase().trim();
    return t === "true" || t === "1" || t === "x" || t === "yes";
  }
  return false;
}

function buildProjectFromRow(row) {
  const jobNumber = getRowValue(row, ["STATE JOB NUMBER", "STATE JOB\nNUMBER"]);
  const districtRaw = getRowValue(row, ["ARDOT DISTRICT", "ARDOT\nDISTRICT"]);
  const totalCostRaw = getRowValue(row, ["TOTAL COST", "TOTAL\nCOST"]);
  const amendmentRaw = getRowValue(row, ["AMENDMENT 101", "AMENDMENT\n 101"]);
  const marineFuelRaw = getRowValue(row, ["MARINE FUEL TAX", "MARINE\nFUEL TAX"]);
  const ferryBoatRaw = getRowValue(row, ["FERRY BOAT", "FERRY\nBOAT"]);
  const stateLocalRaw = getRowValue(row, ["STATE-LOCAL", "STATE-\nLOCAL"]);

  return {
    jobNumber: jobNumber || "",
    termini: row["TERMINI"] || "",
    district: districtRaw || "",
    county: row["COUNTY"] || "",
    route: row["ROUTE"] || "",
    ffy: row["FFY"] || "",
    workType: row["TYPE OF WORK"] || "",
    lengthMiles: Number(row["LENGTH"]) || 0,
    totalCostK: parseFunding(totalCostRaw),

    // Federal programs
    nhppK:        parseFunding(row["NHPP"]),
    nhfpK:        parseFunding(row["NHFP"]),
    hsipK:        parseFunding(row["HSIP"]),
    railHwyK:     parseFunding(row["RAIL-HWY"]),
    earmarkK:     parseFunding(row["EARMARK"]),
    stbgpK:       parseFunding(row["STBGP"]),
    stbgpBroffK:  parseFunding(getRowValue(row, ["STBGP (BR OFF)", "STBGP\n(BR OFF)"])),
    stbgpGt200K:  parseFunding(getRowValue(row, ["STBGP (GT 200K)", "STBGP\n(GT 200K)"])),
    bfpK:         parseFunding(row["BFP"]),
    bfpBroffK:    parseFunding(getRowValue(row, ["BFP (BR OFF)", "BFP\n(BR OFF)"])),
    nevfpK:       parseFunding(row["NEVFP"]),
    crpFlexK:     parseFunding(getRowValue(row, ["CRP (FLEX)", "CRP \n(FLEX)"])),
    crpGt200K:    parseFunding(getRowValue(row, ["CRP (GT 200K)", "CRP \n(GT 200K)"])),
    protectK:     parseFunding(row["PROTECT"]),
    acK:          parseFunding(row["AC"]),
    recTrailsK:   parseFunding(getRowValue(row, ["REC. TRAILS", "REC TRAILS"])),
    cmaqFlexK:    parseFunding(getRowValue(row, ["CMAQ (FLEX)", "CMAQ\n(FLEX)"])),
    cmaqAqK:      parseFunding(getRowValue(row, ["CMAQ (AQ)", "CMAQ\n(AQ)"])),
    tapK:         parseFunding(row["TAP"]),
    tapGt200K:    parseFunding(getRowValue(row, ["TAP (GT 200K)", "TAP\n(GT 200K)"])),
    chbpK:        parseFunding(row["CHBP"]),
    infraK:       parseFunding(row["INFRA"]),
    raiseK:       parseFunding(row["RAISE"]),
    covidK:       parseFunding(row["COVID"]),
    mataK:        parseFunding(row["MATA"]),
    gapK:         parseFunding(row["GAP"]),
    flapK:        parseFunding(row["FLAP"]),
    fltpK:        parseFunding(row["FLTP"]),
    erfoK:        parseFunding(row["ERFO"]),
    ferryBoatK:   parseFunding(ferryBoatRaw),
    dbeK:         parseFunding(row["DBE"]),
    ojtK:         parseFunding(row["OJT"]),

    // State & local
    marineFuelTaxK: parseFunding(marineFuelRaw),
    capK:           parseFunding(row["CAP"]),
    amendment101K:  parseFunding(amendmentRaw),
    stateK:         parseFunding(row["STATE"]),
    act416K:        parseFunding(row["ACT 416"]),
    stateLocalK:    parseFunding(stateLocalRaw),
    localK:         parseFunding(row["LOCAL"]),

    // MPO flags
    carts:    parseMpoFlag(row["CARTS"]),
    jats:     parseMpoFlag(row["JATS"]),
    narts:    parseMpoFlag(row["NARTS"]),
    pbats:    parseMpoFlag(row["PBATS"]),
    tuts:     parseMpoFlag(row["TUTS"]),
    wmats:    parseMpoFlag(row["WMATS"]),
    frontier: parseMpoFlag(row["FRONTIER"]),
    triLakes: parseMpoFlag(row["TRI-LAKES"])
  };
}

/* ---------- Filters ---------- */

function initFilters() {
  const districts = Array.from(new Set(projectData.map(d => d.district))).filter(Boolean).sort();
  const years = Array.from(new Set(projectData.map(d => d.ffy))).filter(Boolean).sort((a, b) => a - b);
  const workTypes = Array.from(new Set(projectData.map(d => d.workType))).filter(Boolean).sort();
  const counties = Array.from(new Set(projectData.map(d => d.county))).filter(Boolean).sort();

  populateSelect(districtFilterEl, districts, "All districts");
  populateSelect(ffyFilterEl, years, "All years");
  populateSelect(workTypeFilterEl, workTypes, "All work types");
  populateSelect(countyFilterEl, counties, "All counties");
}

function populateSelect(selectEl, values, placeholder) {
  selectEl.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "ALL";
  allOpt.textContent = placeholder;
  selectEl.appendChild(allOpt);

  values.forEach(v => {
    const opt = document.createElement("option");
    opt.value = String(v);
    opt.textContent = String(v);
    selectEl.appendChild(opt);
  });
}

function attachEvents() {
  districtFilterEl.addEventListener("change", () => {
    filters.district = districtFilterEl.value;
    updateDashboard();
  });
  ffyFilterEl.addEventListener("change", () => {
    filters.ffy = ffyFilterEl.value;
    updateDashboard();
  });
  workTypeFilterEl.addEventListener("change", () => {
    filters.workType = workTypeFilterEl.value;
    updateDashboard();
  });
  countyFilterEl.addEventListener("change", () => {
    filters.county = countyFilterEl.value;
    updateDashboard();
  });
  searchInputEl.addEventListener("input", () => {
    filters.search = searchInputEl.value.toLowerCase();
    updateDashboard();
  });

  resetFiltersBtn.addEventListener("click", () => {
    filters.district = "ALL";
    filters.ffy = "ALL";
    filters.workType = "ALL";
    filters.county = "ALL";
    filters.search = "";
    districtFilterEl.value = "ALL";
    ffyFilterEl.value = "ALL";
    workTypeFilterEl.value = "ALL";
    countyFilterEl.value = "ALL";
    searchInputEl.value = "";
    updateDashboard();
  });

  downloadCsvBtn.addEventListener("click", () => {
    const filtered = getFilteredData();
    downloadFilteredCsv(filtered);
  });
}

function getFilteredData() {
  return projectData.filter(p => {
    if (filters.district !== "ALL" && String(p.district) !== filters.district) return false;
    if (filters.ffy !== "ALL" && String(p.ffy) !== filters.ffy) return false;
    if (filters.workType !== "ALL" && String(p.workType) !== filters.workType) return false;
    if (filters.county !== "ALL" && String(p.county) !== filters.county) return false;

    if (filters.search) {
      const hay = (
        (p.jobNumber || "") + " " +
        (p.termini || "") + " " +
        (p.route || "")
      ).toLowerCase();
      if (!hay.includes(filters.search)) return false;
    }

    return true;
  });
}

/* ---------- Dashboard updates ---------- */

function updateDashboard() {
  const data = getFilteredData();
  updateFilterLabel(data.length);
  updateSummary(data);
  updateCharts(data);
  updateTable(data);
}

function updateFilterLabel(count) {
  const active = [];
  if (filters.district !== "ALL") active.push(`District ${filters.district}`);
  if (filters.ffy !== "ALL") active.push(`FFY ${filters.ffy}`);
  if (filters.workType !== "ALL") active.push(filters.workType);
  if (filters.county !== "ALL") active.push(filters.county);

  if (active.length === 0) {
    activeFilterLabelEl.textContent = `All projects (no filters) • ${count} total`;
  } else {
    activeFilterLabelEl.textContent = `${count} projects • ${active.join(" • ")}`;
  }
}

/* ---------- Summary KPIs ---------- */

function updateSummary(data) {
  const totalProjects = data.length;
  const totalCostK = data.reduce((sum, p) => sum + (Number(p.totalCostK) || 0), 0);
  const totalMiles = data.reduce((sum, p) => sum + (Number(p.lengthMiles) || 0), 0);
  const avgCostK = totalProjects ? totalCostK / totalProjects : 0;

  let totalFederalK = 0;
  let totalStateLocalK = 0;
  data.forEach(p => {
    FUNDING_PROGRAMS.forEach(fp => {
      const val = p[fp.prop] || 0;
      if (fp.category === "federal") totalFederalK += val;
      else if (fp.category === "stateLocal") totalStateLocalK += val;
    });
  });

  const totalFundingK = totalFederalK + totalStateLocalK;
  const federalSharePct = totalFundingK ? (totalFederalK / totalFundingK) * 100 : 0;
  const stateSharePct = totalFundingK ? (totalStateLocalK / totalFundingK) * 100 : 0;

  let mpoProjects = 0;
  data.forEach(p => {
    if (p.carts || p.jats || p.narts || p.pbats || p.tuts || p.wmats || p.frontier || p.triLakes) {
      mpoProjects += 1;
    }
  });
  const mpoSharePct = totalProjects ? (mpoProjects / totalProjects) * 100 : 0;

  summaryGridEl.innerHTML = "";

  const summaryItems = [
    {
      label: "Total projects",
      value: totalProjects.toLocaleString(),
      sub: "Across all filters"
    },
    {
      label: "Program cost",
      value: "$" + (totalCostK / 1000).toFixed(1) + "M",
      sub: "Total (thousands \u2192 millions)"
    },
    {
      label: "Program length",
      value: totalMiles.toFixed(1) + " mi",
      sub: "Sum of project lengths"
    },
    {
      label: "Avg. cost per project",
      value: "$" + avgCostK.toFixed(0) + "K",
      sub: "Based on filtered set"
    },
    {
      label: "Federal share",
      value: federalSharePct.toFixed(0) + "%",
      sub: "Of federal + state/local dollars"
    },
    {
      label: "Projects in MPO areas",
      value: mpoSharePct.toFixed(0) + "%",
      sub: `${mpoProjects.toLocaleString()} of ${totalProjects.toLocaleString()} projects`
    }
  ];

  summaryItems.forEach(item => {
    const div = document.createElement("div");
    div.className = "summary-item";
    div.innerHTML = `
      <div class="summary-label">${item.label}</div>
      <div class="summary-value">${item.value}</div>
      <div class="summary-sub">${item.sub}</div>
    `;
    summaryGridEl.appendChild(div);
  });
}

/* ---------- Charts ---------- */

function initCharts() {
  const ctxYearLine = document.getElementById("costByYearLineChart").getContext("2d");
  const ctxWorkType = document.getElementById("projectsByWorkTypeChart").getContext("2d");
  const ctxFunding = document.getElementById("fundingProgramsChart").getContext("2d");

  costByYearLineChart = new Chart(ctxYearLine, {
    type: "line",
    data: { labels: [], datasets: [] },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Total Cost by FFY (Millions $)",
          font: { size: 13, weight: "600" }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` $${ctx.parsed.y.toFixed(2)}M`
          }
        }
      },
      scales: {
        x: {
          ticks: { font: { size: 10 } },
          grid: { display: false }
        },
        y: {
          ticks: { font: { size: 10 } },
          beginAtZero: true
        }
      }
    }
  });

  projectsByWorkTypeChart = new Chart(ctxWorkType, {
    type: "bar",
    data: { labels: [], datasets: [] },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Projects by Type of Work",
          font: { size: 13, weight: "600" }
        }
      },
      scales: {
        x: {
          ticks: { font: { size: 10 } },
          beginAtZero: true
        },
        y: {
          ticks: { font: { size: 9 } }
        }
      }
    }
  });

  fundingProgramsChart = new Chart(ctxFunding, {
    type: "bar",
    data: { labels: [], datasets: [] },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Top Funding Programs (Millions $)",
          font: { size: 13, weight: "600" }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` $${ctx.parsed.x.toFixed(2)}M`
          }
        }
      },
      scales: {
        x: {
          ticks: { font: { size: 10 } },
          beginAtZero: true
        },
        y: {
          ticks: { font: { size: 9 } }
        }
      }
    }
  });
}

function updateCharts(data) {
  // FFY axis
  const yearSet = new Set();
  data.forEach(p => {
    if (p.ffy !== "" && p.ffy !== null && p.ffy !== undefined) yearSet.add(String(p.ffy));
  });
  const years = Array.from(yearSet).sort((a, b) => Number(a) - Number(b));

  // Line: total cost by year
  const costByYear = {};
  years.forEach(y => { costByYear[y] = 0; });
  data.forEach(p => {
    const y = String(p.ffy || "");
    if (!years.includes(y)) return;
    const costK = Number(p.totalCostK) || 0;
    costByYear[y] += costK;
  });

  const lineData = years.map(y => (costByYear[y] || 0) / 1000);
  costByYearLineChart.data.labels = years;
  costByYearLineChart.data.datasets = [
    {
      label: "Total Cost",
      data: lineData,
      tension: 0.25,
      borderWidth: 2,
      borderColor: "#2563eb",
      pointBackgroundColor: "#1d4ed8",
      pointRadius: 3,
      fill: false
    }
  ];
  costByYearLineChart.update();

  // Projects by work type
  const countByWorkType = {};
  data.forEach(p => {
    const key = p.workType || "Unknown";
    countByWorkType[key] = (countByWorkType[key] || 0) + 1;
  });

  const workLabels = Object.keys(countByWorkType)
    .sort((a, b) => countByWorkType[b] - countByWorkType[a]);
  const workData = workLabels.map(w => countByWorkType[w]);

  projectsByWorkTypeChart.data.labels = workLabels;
  projectsByWorkTypeChart.data.datasets = [
    {
      label: "Projects",
      data: workData,
      backgroundColor: "rgba(37, 99, 235, 0.8)",
      borderColor: "#1d4ed8",
      borderWidth: 1
    }
  ];
  projectsByWorkTypeChart.update();

  // Top funding programs
  const programTotalsK = {};
  FUNDING_PROGRAMS.forEach(fp => { programTotalsK[fp.prop] = 0; });

  data.forEach(p => {
    FUNDING_PROGRAMS.forEach(fp => {
      programTotalsK[fp.prop] += p[fp.prop] || 0;
    });
  });

  const programEntries = FUNDING_PROGRAMS.map(fp => ({
    label: fp.label,
    totalK: programTotalsK[fp.prop] || 0
  })).filter(e => e.totalK > 0);

  programEntries.sort((a, b) => b.totalK - a.totalK);
  const topPrograms = programEntries.slice(0, 7);

  const fundingLabels = topPrograms.map(p => p.label);
  const fundingData = topPrograms.map(p => p.totalK / 1000);

  fundingProgramsChart.data.labels = fundingLabels;
  fundingProgramsChart.data.datasets = [
    {
      label: "Funding",
      data: fundingData,
      backgroundColor: "rgba(37, 99, 235, 0.8)",
      borderColor: "#1d4ed8",
      borderWidth: 1
    }
  ];
  fundingProgramsChart.update();
}

/* ---------- Table + CSV ---------- */

function updateTable(data) {
  tableBodyEl.innerHTML = "";
  data.forEach(p => {
    const tr = document.createElement("tr");

    const jobTd = document.createElement("td");
    jobTd.textContent = p.jobNumber || "";
    tr.appendChild(jobTd);

    const termTd = document.createElement("td");
    termTd.textContent = p.termini || "";
    tr.appendChild(termTd);

    const distTd = document.createElement("td");
    distTd.innerHTML = `<span class="pill district">${p.district || ""}</span>`;
    tr.appendChild(distTd);

    const countyTd = document.createElement("td");
    countyTd.textContent = p.county || "";
    tr.appendChild(countyTd);

    const routeTd = document.createElement("td");
    routeTd.textContent = p.route || "";
    tr.appendChild(routeTd);

    const ffyTd = document.createElement("td");
    ffyTd.textContent = p.ffy || "";
    tr.appendChild(ffyTd);

    const workTd = document.createElement("td");
    workTd.innerHTML = `<span class="pill work">${p.workType || ""}</span>`;
    tr.appendChild(workTd);

    const lenTd = document.createElement("td");
    lenTd.textContent = (Number(p.lengthMiles) || 0).toFixed(2);
    tr.appendChild(lenTd);

    const costTd = document.createElement("td");
    costTd.textContent = (Number(p.totalCostK) || 0).toLocaleString();
    tr.appendChild(costTd);

    tableBodyEl.appendChild(tr);
  });

  tableCountLabelEl.textContent = `${data.length.toLocaleString()} project${data.length === 1 ? "" : "s"} shown`;
}

function downloadFilteredCsv(filtered) {
  if (!filtered.length) {
    alert("No projects in the current filter to download.");
    return;
  }

  const headers = [
    "JobNumber",
    "Termini",
    "District",
    "County",
    "Route",
    "FFY",
    "TypeOfWork",
    "LengthMiles",
    "TotalCostK"
  ];

  const lines = [];
  lines.push(headers.join(","));

  filtered.forEach(p => {
    const rowValues = [
      p.jobNumber,
      String(p.termini || "").replace(/"/g, '""'),
      p.district,
      p.county,
      p.route,
      p.ffy,
      String(p.workType || "").replace(/"/g, '""'),
      p.lengthMiles,
      p.totalCostK
    ].map(val => {
      if (typeof val === "string" && (val.includes(",") || val.includes('"'))) {
        return `"${val}"`;
      }
      return val;
    });
    lines.push(rowValues.join(","));
  });

  const csvContent = lines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "ARDOT_STIP_filtered.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
