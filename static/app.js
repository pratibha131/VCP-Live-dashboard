const state = {
  data: null,
  selectedThemeId: null,
  selectedActionId: null,
  selectedDependencyId: null,
  workbookVersion: null,
  pollTimer: null,
  toastTimer: null,
  viewMode: "overall", // 'overall' or 'detail'
};

const elements = {
  functionSelect: document.getElementById("functionSelect"),
  yearSegment: document.getElementById("yearSegment"),
  selectionCaption: document.getElementById("selectionCaption"),
  totalThemes: document.getElementById("totalThemes"),
  activeActionItems: document.getElementById("activeActionItems"),
  completedActionItems: document.getElementById("completedActionItems"),
  notStartedActionItems: document.getElementById("notStartedActionItems"),
  totalActionItems: document.getElementById("totalActionItems"),
  totalThemesNote: document.getElementById("totalThemesNote"),
  activeActionItemsNote: document.getElementById("activeActionItemsNote"),
  completedActionItemsNote: document.getElementById("completedActionItemsNote"),
  notStartedActionItemsNote: document.getElementById("notStartedActionItemsNote"),
  totalActionItemsNote: document.getElementById("totalActionItemsNote"),
  themeProgressChip: document.getElementById("themeProgressChip"),
  themeTabs: document.getElementById("themeTabs"),
  actionNetwork: document.getElementById("actionNetwork"),
  mobileActionList: document.getElementById("mobileActionList"),
  networkEmpty: document.getElementById("networkEmpty"),
  actionDetail: document.getElementById("actionDetail"),
  journeyList: document.getElementById("journeyList"),
  attentionList: document.getElementById("attentionList"),
  syncStatus: document.getElementById("syncStatus"),
  syncMeta: document.getElementById("syncMeta"),
  livePulse: document.getElementById("livePulse"),
  refreshButton: document.getElementById("refreshButton"),
  alertBanner: document.getElementById("alertBanner"),
  toast: document.getElementById("toast"),
  loadingOverlay: document.getElementById("loadingOverlay"),
  overallSection: document.getElementById("overallSection"),
  detailViewContainer: document.getElementById("detailViewContainer"),
  backToOverallBtn: document.getElementById("backToOverallBtn"),
  overallTotalThemes: document.getElementById("overallTotalThemes"),
  overallActiveActionItems: document.getElementById("overallActiveActionItems"),
  overallCompletedActionItems: document.getElementById("overallCompletedActionItems"),
  overallNotStartedActionItems: document.getElementById("overallNotStartedActionItems"),
  overallTotalActionItems: document.getElementById("overallTotalActionItems"),
  protoTableBodyCol1: document.getElementById("protoTableBodyCol1"),
  protoTableBodyCol2: document.getElementById("protoTableBodyCol2"),
  protoTableBodyCol3: document.getElementById("protoTableBodyCol3"),
  protoTableBodyCol4: document.getElementById("protoTableBodyCol4"),
  functionCardsGrid: document.getElementById("functionCardsGrid"),
};

const statusLabels = {
  complete: "Completed",
  active: "Active",
  not_started: "Not started",
  at_risk: "At risk",
  blocked: "Blocked",
  no_update: "No update",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatProgress(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  const number = Number(value);
  return `${Number.isInteger(number) ? number : number.toFixed(1)}%`;
}

function truncate(value, length = 52) {
  const text = String(value ?? "").trim();
  return text.length > length ? `${text.slice(0, length - 1).trim()}…` : text;
}

function statusLabel(status) {
  return statusLabels[status] || "No update";
}

function cssStatus(status) {
  return String(status || "no_update").replaceAll("_", "-");
}

function getStatusColor(status) {
  switch (status) {
    case 'complete': return '#2c9992'; // Teal
    case 'active': return '#157bb3'; // Blue
    case 'at_risk': return '#ec9b22'; // Orange
    case 'blocked': return '#e2525e'; // Red
    case 'not_started': return '#95a2b3'; // Slate
    default: return '#95a2b3'; // Slate
  }
}

function showLoading(show) {
  elements.loadingOverlay.classList.toggle("is-visible", Boolean(show));
  elements.loadingOverlay.setAttribute("aria-hidden", show ? "false" : "true");
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  state.toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3200);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      message = payload.detail || message;
    } catch (_) {
      // Use the HTTP status when the response is not JSON.
    }
    throw new Error(message);
  }
  return response.json();
}

function currentTheme() {
  return state.data?.themes?.find((theme) => theme.id === state.selectedThemeId) || null;
}

function currentDependency() {
  const theme = currentTheme();
  if (!theme) return null;
  return theme.dependencies.find((dependency) => dependency.id === state.selectedDependencyId) || null;
}

function setConnectionState(ok, statusText, metaText) {
  if (elements.livePulse) elements.livePulse.classList.toggle("error", !ok);
  if (elements.syncStatus) elements.syncStatus.textContent = statusText;
  if (elements.syncMeta) elements.syncMeta.textContent = metaText;
}

async function loadDashboard(functionName = null, year = null, options = {}) {
  const { silent = false, preserveTheme = true } = options;
  if (!silent && !state.data) showLoading(true);

  const previousThemeId = preserveTheme ? state.selectedThemeId : null;
  const previousDependencyId = preserveTheme ? state.selectedDependencyId : null;
  const parameters = new URLSearchParams();
  if (functionName) parameters.set("function", functionName);
  if (year) parameters.set("year", String(year));

  try {
    const payload = await fetchJson(`/api/dashboard?${parameters.toString()}`);
    state.data = payload;
    state.workbookVersion = payload.source?.version || null;

    const preservedTheme = payload.themes?.find((theme) => theme.id === previousThemeId);
    state.selectedThemeId = preservedTheme?.id || payload.themes?.[0]?.id || null;

    const selectedTheme = currentTheme();
    const preservedDependency = selectedTheme?.dependencies?.find((dependency) => dependency.id === previousDependencyId);
    state.selectedDependencyId = preservedDependency?.id || selectedTheme?.dependencies?.[0]?.id || null;
    state.selectedActionId = selectedTheme?.actions?.[0]?.id || null;

    renderDashboard();
    saveSelection();

    setConnectionState(
      true,
      "Excel connected · auto-refresh on",
      `Workbook saved ${payload.source?.modified_display || "recently"}`,
    );

    if (payload.last_error) {
      elements.alertBanner.textContent = `The latest workbook save could not be read, so the last valid dashboard is being shown: ${payload.last_error}`;
      elements.alertBanner.classList.remove("is-hidden");
    } else {
      elements.alertBanner.classList.add("is-hidden");
    }
  } catch (error) {
    setConnectionState(false, "Workbook connection issue", error.message);
    elements.alertBanner.textContent = error.message;
    elements.alertBanner.classList.remove("is-hidden");
    if (!state.data) renderFailure(error.message);
  } finally {
    if (!silent) showLoading(false);
  }
}

function saveSelection() {
  if (!state.data?.selection) return;
  try {
    if (state.viewMode === "overall") {
      localStorage.setItem("vcp-dashboard-function", "_all_");
    } else {
      localStorage.setItem("vcp-dashboard-function", state.data.selection.function);
      localStorage.setItem("vcp-dashboard-year", String(state.data.selection.year));
    }
  } catch (_) {
    // Local storage can be unavailable in strict privacy modes.
  }
}

function renderFailure(message) {
  elements.totalThemes.textContent = "—";
  elements.activeActionItems.textContent = "—";
  elements.completedActionItems.textContent = "—";
  elements.notStartedActionItems.textContent = "—";
  elements.networkEmpty.classList.remove("is-hidden");
  elements.networkEmpty.querySelector("h3").textContent = "Dashboard data unavailable";
  elements.networkEmpty.querySelector("p").textContent = message;
  elements.actionNetwork.innerHTML = "";
  elements.mobileActionList.innerHTML = "";
  elements.journeyList.innerHTML = "";
  elements.attentionList.innerHTML = "";
}

function renderDashboard() {
  renderFilters();
  renderSummary();
  renderThemeTabs();
  renderSelectedTheme();
  renderJourney();
  renderAttention();
  renderOverallView();
  toggleViewMode();
}

function renderFilters() {
  const data = state.data;
  const selectedFunction = data.selection.function;
  const selectedYear = data.selection.year;

  const allFunctionsSelected = state.viewMode === "overall" ? " selected" : "";
  elements.functionSelect.innerHTML = `<option value="_all_"${allFunctionsSelected}>All Functions</option>` + data.functions
    .map((item) => {
      const selected = (item.name === selectedFunction && state.viewMode === "detail") ? " selected" : "";
      return `<option value="${escapeHtml(item.name)}"${selected}>${escapeHtml(item.name)}</option>`;
    })
    .join("");

  elements.yearSegment.innerHTML = data.years
    .map((year) => `
      <button type="button" class="year-button${year === selectedYear ? " is-active" : ""}" data-year="${year}" aria-pressed="${year === selectedYear}">
        ${year}
      </button>
    `)
    .join("");

  elements.selectionCaption.innerHTML = `Viewing <strong>${escapeHtml(selectedFunction)}</strong><br>${selectedYear} execution plan`;
}

function renderSummary() {
  const themes = state.data.themes || [];
  if (elements.totalThemes) elements.totalThemes.textContent = themes.length;

  let totalActive = 0;
  let totalCompleted = 0;
  let totalNotStarted = 0;
  let atRiskCount = 0;
  let blockedCount = 0;

  themes.forEach((theme) => {
    (theme.actions || []).forEach((action) => {
      if (action.status === "complete") {
        totalCompleted += 1;
      } else if (action.status === "not_started" || action.status === "no_update") {
        totalNotStarted += 1;
      } else {
        totalActive += 1;
        if (action.status === "at_risk") atRiskCount += 1;
        if (action.status === "blocked") blockedCount += 1;
      }
    });
  });

  if (elements.activeActionItems) elements.activeActionItems.textContent = totalActive;
  if (elements.completedActionItems) elements.completedActionItems.textContent = totalCompleted;
  if (elements.notStartedActionItems) elements.notStartedActionItems.textContent = totalNotStarted;

  const totalActions = totalCompleted + totalActive + totalNotStarted;
  if (elements.totalActionItems) elements.totalActionItems.textContent = totalActions;

  if (elements.overallTotalThemes) elements.overallTotalThemes.textContent = themes.length;
  if (elements.overallActiveActionItems) elements.overallActiveActionItems.textContent = totalActive;
  if (elements.overallCompletedActionItems) elements.overallCompletedActionItems.textContent = totalCompleted;
  if (elements.overallNotStartedActionItems) elements.overallNotStartedActionItems.textContent = totalNotStarted;
  if (elements.overallTotalActionItems) elements.overallTotalActionItems.textContent = totalActions;

  const riskTotal = atRiskCount + blockedCount;
  state.summaryMetrics = {
    totalThemes: themes.length,
    totalActive,
    totalCompleted,
    totalNotStarted,
    totalActions,
    riskTotal,
  };

  const detailTotalThemes = document.getElementById("detailTotalThemes");
  const detailTotalActionItems = document.getElementById("detailTotalActionItems");
  const detailNotStartedActionItems = document.getElementById("detailNotStartedActionItems");
  const detailActiveActionItems = document.getElementById("detailActiveActionItems");
  const detailCompletedActionItems = document.getElementById("detailCompletedActionItems");

  if (detailTotalThemes) detailTotalThemes.textContent = themes.length;
  if (detailTotalActionItems) detailTotalActionItems.textContent = totalActions;
  if (detailNotStartedActionItems) detailNotStartedActionItems.textContent = totalNotStarted;
  if (detailActiveActionItems) detailActiveActionItems.textContent = totalActive;
  if (detailCompletedActionItems) detailCompletedActionItems.textContent = totalCompleted;
}

function cleanThemeName(name) {
  if (!name) return "";
  // Split by ' - ' or ' – ' or ' — ' and take the first part
  let clean = name.split(/\s*[-–—]\s*/)[0];
  // Also strip trailing metrics like " 1.9M", " 2M", " +0.5M", " 1.5" etc.
  clean = clean.replace(/\s+[\+\-]?\d+(\.\d+)?[MK]?$/i, "");
  return clean.trim();
}

function renderThemeTabs() {
  const themes = state.data.themes || [];
  elements.themeTabs.innerHTML = themes
    .map((theme) => {
      const displayName = cleanThemeName(theme.name);
      return `
        <button type="button" role="tab" class="theme-tab${theme.id === state.selectedThemeId ? " is-active" : ""}"
          data-theme-id="${escapeHtml(theme.id)}" aria-selected="${theme.id === state.selectedThemeId}" title="${escapeHtml(theme.name)}">
          ${escapeHtml(truncate(displayName, 48))}
        </button>
      `;
    })
    .join("");
  elements.themeTabs.classList.toggle("is-hidden", themes.length === 0);
}

function visibleActions(actions) {
  if (actions.length <= 6) return actions;
  const remainder = actions.slice(5);
  const progressValues = remainder.map((action) => action.progress).filter((value) => value !== null && value !== undefined);
  const average = progressValues.length
    ? Math.round((progressValues.reduce((sum, value) => sum + Number(value), 0) / progressValues.length) * 10) / 10
    : null;
  return [
    ...actions.slice(0, 5),
    {
      id: "grouped-more-actions",
      description: `${remainder.length} additional action items`,
      progress: average,
      status: average === null ? "no_update" : average >= 100 ? "complete" : average <= 0 ? "not_started" : "active",
      status_label: "Additional actions",
      timeline: "",
      owner: "Multiple actions",
      isGroup: true,
      groupedActions: remainder,
    },
  ];
}

function renderSelectedTheme() {
  const theme = currentTheme();
  if (!theme) {
    elements.networkEmpty.classList.remove("is-hidden");
    elements.actionNetwork.classList.add("is-hidden");
    elements.mobileActionList.classList.add("is-hidden");
    if (elements.actionDetail) elements.actionDetail.classList.add("is-hidden");
    if (elements.themeProgressChip) elements.themeProgressChip.textContent = "No theme data";
    return;
  }

  elements.networkEmpty.classList.add("is-hidden");
  elements.actionNetwork.classList.remove("is-hidden");
  elements.mobileActionList.classList.remove("is-hidden");
  if (elements.actionDetail) elements.actionDetail.classList.remove("is-hidden");
  if (elements.themeProgressChip) elements.themeProgressChip.textContent = `${theme.status_label} · ${formatProgress(theme.progress)}`;

  const actions = visibleActions(theme.actions || []);
  renderDesktopActionNetwork(theme, actions);
  renderMobileActionNetwork(theme, actions);

  const selectedAction = actions.find((action) => action.id === state.selectedActionId) || actions[0] || null;
  if (selectedAction) {
    state.selectedActionId = selectedAction.id;
    renderActionDetail(selectedAction);
  } else {
    if (elements.actionDetail) {
      elements.actionDetail.innerHTML = `<div class="action-detail-main"><strong>No action descriptions entered</strong><p>Add action text and progress in the Excel sheet to populate this branch view.</p></div>`;
    }
  }
}

function actionPositions(count) {
  if (count === 1) return [{ x: 800, y: 285 }];
  if (count === 2) return [{ x: 235, y: 285 }, { x: 765, y: 285 }];

  const centerX = 500;
  const centerY = 285;
  const radiusX = count >= 5 ? 355 : 335;
  const radiusY = count >= 5 ? 205 : 195;
  const startAngle = -90;
  return Array.from({ length: count }, (_, index) => {
    const angle = (startAngle + (360 / count) * index) * Math.PI / 180;
    return {
      x: centerX + radiusX * Math.cos(angle),
      y: centerY + radiusY * Math.sin(angle),
    };
  });
}

function renderDesktopActionNetwork(theme, actions) {
  const svg = elements.actionNetwork;
  const centerX = 500;
  const centerY = 285;
  const centralRadius = 105;
  const cardWidth = 235;
  const cardHeight = 94;
  const positions = actionPositions(actions.length);

  const definitions = `
    <defs>
      <linearGradient id="themeGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#153a69"/>
        <stop offset="62%" stop-color="#197ca0"/>
        <stop offset="100%" stop-color="#2c9992"/>
      </linearGradient>
    </defs>
  `;

  const branches = actions.map((action, index) => {
    const position = positions[index];
    const dx = position.x - centerX;
    const dy = position.y - centerY;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    const startX = centerX + (dx / length) * centralRadius;
    const startY = centerY + (dy / length) * centralRadius;
    const endX = position.x - (dx / length) * Math.min(cardWidth / 2, 92);
    const endY = position.y - (dy / length) * Math.min(cardHeight / 2, 42);
    const controlX = centerX + dx * 0.52;
    const controlY = centerY + dy * 0.28;
    return `<path class="branch-path ${escapeHtml(cssStatus(action.status))}" d="M ${startX.toFixed(1)} ${startY.toFixed(1)} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}"/>`;
  }).join("");

  const nodes = actions.map((action, index) => {
    const position = positions[index];
    const x = clamp(position.x - cardWidth / 2, 22, 1000 - cardWidth - 22);
    const y = clamp(position.y - cardHeight / 2, 20, 570 - cardHeight - 20);
    const selectedClass = action.id === state.selectedActionId ? " is-selected" : "";
    return `
      <g class="action-node${selectedClass}" data-action-id="${escapeHtml(action.id)}" tabindex="0" role="button" aria-label="${escapeHtml(action.description)}">
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cardWidth}" height="${cardHeight}" rx="17"/>
        <foreignObject x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cardWidth}" height="${cardHeight}">
          <div xmlns="http://www.w3.org/1999/xhtml" class="action-node-card status-${escapeHtml(cssStatus(action.status))}">
            <div class="action-node-top">
              <span class="action-index">ACTION ${String(index + 1).padStart(2, "0")}</span>
              <span class="action-progress">${escapeHtml(formatProgress(action.progress))}</span>
            </div>
            <p>${escapeHtml(action.description)}</p>
          </div>
        </foreignObject>
        <circle class="node-status-mark ${escapeHtml(cssStatus(action.status))}" cx="${(x + cardWidth - 13).toFixed(1)}" cy="${(y + 13).toFixed(1)}" r="6"/>
      </g>
    `;
  }).join("");

  const progressVal = theme.progress !== null && theme.progress !== undefined ? clamp(Number(theme.progress), 0, 100) : 0;
  const central = `
    <circle class="central-halo" cx="${centerX}" cy="${centerY}" r="133"/>
    <circle class="central-circle" cx="${centerX}" cy="${centerY}" r="${centralRadius}"/>
    <foreignObject x="${centerX - centralRadius}" y="${centerY - centralRadius}" width="${centralRadius * 2}" height="${centralRadius * 2}">
      <div xmlns="http://www.w3.org/1999/xhtml" class="central-bubble-content">
        <div class="water-container">
          <div class="water-fill" style="height: ${progressVal}%">
            <div class="water-wave"></div>
            <div class="water-wave-behind"></div>
          </div>
        </div>
        <div class="central-text-wrap">
          <span class="central-label">KEY THEME</span>
          <strong>${escapeHtml(theme.name)}</strong>
          <span class="central-progress">${escapeHtml(formatProgress(theme.progress))}</span>
        </div>
      </div>
    </foreignObject>
  `;

  svg.innerHTML = definitions + branches + central + nodes;
  svg.querySelectorAll(".action-node").forEach((node) => {
    const activate = () => selectAction(node.dataset.actionId, actions);
    node.addEventListener("click", activate);
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
  });
}

function renderMobileActionNetwork(theme, actions) {
  elements.mobileActionList.innerHTML = `
    <div class="mobile-theme-bubble">
      <div>
        <span>KEY THEME</span>
        <strong>${escapeHtml(theme.name)}</strong>
        <b>${escapeHtml(formatProgress(theme.progress))}</b>
      </div>
    </div>
    ${actions.map((action, index) => `
      <button type="button" class="mobile-action-card" data-action-id="${escapeHtml(action.id)}">
        <span class="mobile-action-index">${String(index + 1).padStart(2, "0")}</span>
        <p>${escapeHtml(action.description)}</p>
        <em>${escapeHtml(formatProgress(action.progress))}</em>
      </button>
    `).join("")}
  `;

  elements.mobileActionList.querySelectorAll("[data-action-id]").forEach((button) => {
    button.addEventListener("click", () => selectAction(button.dataset.actionId, actions));
  });
}

function selectAction(actionId, actions = null) {
  const theme = currentTheme();
  const displayedActions = actions || visibleActions(theme?.actions || []);
  const action = displayedActions.find((item) => item.id === actionId);
  if (!action) return;
  state.selectedActionId = action.id;
  renderDesktopActionNetwork(theme, displayedActions);
  renderActionDetail(action);
}

function renderActionDetail(action) {
  if (!elements.actionDetail) return;
  const description = action.isGroup
    ? action.groupedActions.map((item) => item.description).join(" · ")
    : action.description;
  elements.actionDetail.innerHTML = `
    <div class="action-detail-main">
      <strong>${action.isGroup ? escapeHtml(action.description) : "Selected action"}</strong>
      <p>${escapeHtml(description)}</p>
    </div>
    <div class="action-detail-meta">
      <span>Status</span>
      <strong>${escapeHtml(action.status_label || statusLabel(action.status))}</strong>
    </div>
    <div class="action-detail-meta">
      <span>Timeline</span>
      <strong>${escapeHtml(action.timeline || "Not entered")}</strong>
    </div>
  `;
}

function shipIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 15.5 6.2 19h11.6l2.2-3.5-8 1.4-8-1.4Z"/>
      <path d="M12 4v12M12 5l5 5h-5M12 7 8 11h4M3.5 20c1.5 1 3 1 4.5 0 1.5 1 3 1 4.5 0 1.5 1 3 1 4.5 0"/>
    </svg>
  `;
}

function renderJourney() {
  const themes = state.data.themes || [];
  if (!themes.length) {
    elements.journeyList.innerHTML = `<div class="no-dependency-row">No key themes are available for this selection.</div>`;
    return;
  }

  elements.journeyList.innerHTML = themes.map((theme) => {
    const dependencies = theme.dependencies || [];
    const isSelected = theme.id === state.selectedThemeId;
    const progress = clamp(Number(theme.dependency_progress ?? 0), 0, 100);
    const minWidth = Math.max(520, dependencies.length * 105);
    const nodeColumns = Math.max(dependencies.length, 1);

    const dependencyTrack = dependencies.length ? `
      <div class="journey-track-scroll">
        <div class="journey-track" style="min-width:${minWidth}px">
          <div class="track-line-base"></div>
          <div class="dependency-nodes" style="grid-template-columns:repeat(${nodeColumns}, minmax(88px, 1fr))">
            ${dependencies.map((dependency) => {
              const completedCount = dependency.actions ? dependency.actions.filter(act => act.status === 'complete').length : 0;
              const totalCount = dependency.actions ? dependency.actions.length : 0;
              const completionText = totalCount > 0 ? ` (${completedCount}/${totalCount})` : "";
              const firstActionDesc = dependency.actions?.[0]?.description || dependency.function;
              
              return `
                <button type="button" class="dependency-node${dependency.id === state.selectedDependencyId && isSelected ? " is-selected" : ""}"
                  data-theme-id="${escapeHtml(theme.id)}" data-dependency-id="${escapeHtml(dependency.id)}" title="${escapeHtml(firstActionDesc)}">
                  <div class="node-dot-wrapper">
                    <span class="node-dot ${escapeHtml(cssStatus(dependency.status))}"></span>
                    ${dependency.actions && dependency.actions.length > 0 ? `
                      <div class="action-mini-dots">
                        ${dependency.actions.map(action => {
                          const themeColor = getStatusColor(action.status);
                          const actionProg = action.progress !== null && action.progress !== undefined ? action.progress : 0;
                          return `
                            <span class="action-mini-dot" 
                              style="background: conic-gradient(${themeColor} 0% ${actionProg}%, #edf1f6 ${actionProg}% 100%)" 
                              title="${escapeHtml(action.description)} (${formatProgress(action.progress)})">
                            </span>
                          `;
                        }).join("")}
                      </div>
                    ` : ""}
                  </div>
                  <span class="node-label">${escapeHtml(dependency.function)}${completionText}</span>
                </button>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    ` : `<div class="no-dependency-row">No cross-functional dependencies have been entered for this key theme.</div>`;

    const taskGrid = isSelected && dependencies.length ? `
      <div class="dependency-task-grid" style="grid-template-columns:repeat(${nodeColumns}, minmax(88px, 1fr))">
        ${dependencies.map((dependency) => {
          const firstDesc = dependency.actions?.[0]?.description || "Action not entered";
          return `<span title="${escapeHtml(firstDesc)}">${escapeHtml(truncate(firstDesc, 58))}</span>`;
        }).join("")}
      </div>
    ` : "";

    const activeDep = dependencies.find(dep => dep.id === state.selectedDependencyId);
    let inlineDetailHtml = "";
    if (isSelected && activeDep) {
      const actions = activeDep.actions || [];
      const completedCount = actions.filter(act => act.status === 'complete').length;

      inlineDetailHtml = `
        <div class="journey-row-detail">
          <div class="dep-detail-header">
            <div>
              <div class="detail-kicker">${escapeHtml(theme.name)}</div>
              <h3>${escapeHtml(activeDep.function)} dependency actions</h3>
            </div>
            <div class="dep-detail-summary-badge">
              <span class="status-badge ${escapeHtml(cssStatus(activeDep.status))}">${escapeHtml(activeDep.status_label)}</span>
              <strong>${completedCount}/${actions.length} Complete</strong>
            </div>
          </div>
          <div class="dep-actions-table-wrap">
            <table class="dep-actions-table">
              <thead>
                <tr>
                  <th>Action Item</th>
                  <th>Target Date</th>
                  <th>Progress / Status</th>
                </tr>
              </thead>
              <tbody>
                ${actions.map(action => `
                  <tr>
                    <td class="action-desc-cell">${escapeHtml(action.description)}</td>
                    <td>${escapeHtml(action.timeline || "Not entered")}</td>
                    <td>
                      <div class="action-progress-cell">
                        <div class="action-progress-bar-wrap">
                          <div class="action-progress-bar" style="width: ${action.progress !== null ? action.progress : 0}%"></div>
                        </div>
                        <span class="status-badge ${escapeHtml(cssStatus(action.status))}">${escapeHtml(action.status_label)} (${formatProgress(action.progress)})</span>
                      </div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    return `
      <article class="journey-row${isSelected ? " is-selected" : ""}" data-theme-row="${escapeHtml(theme.id)}">
        <button type="button" class="journey-theme" data-theme-id="${escapeHtml(theme.id)}">
          <strong>${escapeHtml(theme.name)}</strong>
          <span>${dependencies.length} dependent function${dependencies.length === 1 ? "" : "s"} · ${escapeHtml(theme.status_label)}</span>
        </button>
        ${dependencyTrack}
        <div class="journey-score">
          <strong>${escapeHtml(formatProgress(theme.dependency_progress))}</strong>
          <span>dependency<br>progress</span>
        </div>
        ${taskGrid}
        ${inlineDetailHtml}
      </article>
    `;
  }).join("");

  elements.journeyList.querySelectorAll(".journey-theme").forEach((button) => {
    button.addEventListener("click", () => selectTheme(button.dataset.themeId));
  });

  elements.journeyList.querySelectorAll(".dependency-node").forEach((button) => {
    button.addEventListener("click", () => selectDependency(button.dataset.themeId, button.dataset.dependencyId));
  });
}

function selectTheme(themeId) {
  const theme = state.data.themes.find((item) => item.id === themeId);
  if (!theme) return;
  state.selectedThemeId = theme.id;
  state.selectedActionId = theme.actions?.[0]?.id || null;
  state.selectedDependencyId = theme.dependencies?.[0]?.id || null;
  renderThemeTabs();
  renderSelectedTheme();
  renderJourney();
}

function selectDependency(themeId, dependencyId) {
  const theme = state.data.themes.find((item) => item.id === themeId);
  if (!theme) return;
  const dependency = theme.dependencies.find((item) => item.id === dependencyId);
  if (!dependency) return;
  state.selectedThemeId = themeId;
  state.selectedDependencyId = dependencyId;
  state.selectedActionId = theme.actions?.[0]?.id || null;
  renderThemeTabs();
  renderSelectedTheme();
  renderJourney();
}

function renderAttention() {
  const themes = state.data.themes || [];
  const attentionItems = [];
  let totalTracked = 0;
  let updated = 0;

  themes.forEach((theme) => {
    (theme.actions || []).forEach((action) => {
      totalTracked += 1;
      if (action.progress !== null && action.progress !== undefined) updated += 1;
      if (["at_risk", "blocked", "no_update"].includes(action.status)) {
        attentionItems.push({
          priority: action.status === "blocked" ? 0 : action.status === "at_risk" ? 1 : 4,
          status: action.status,
          title: `${theme.name} · function action`,
          description: action.description,
        });
      }
    });

    (theme.dependencies || []).forEach((dependency) => {
      totalTracked += 1;
      if (dependency.progress !== null && dependency.progress !== undefined) updated += 1;
      if (["at_risk", "blocked", "no_update", "not_started"].includes(dependency.status)) {
        const allNoUpdate = dependency.actions && dependency.actions.every(act => act.status === "no_update" || act.status === "not_started" || act.status === "");
        attentionItems.push({
          priority: dependency.status === "blocked" ? 0 : dependency.status === "at_risk" ? 1 : dependency.status === "no_update" ? 2 : 3,
          status: dependency.status,
          title: `${theme.name} · ${dependency.function}`,
          description: dependency.actions?.[0]?.description || "Dependency action has not been entered.",
          allNoUpdate: allNoUpdate,
        });
      }
    });
  });

  attentionItems.sort((a, b) => a.priority - b.priority);
  const displayed = attentionItems.slice(0, 4);

  if (!displayed.length) {
    elements.attentionList.innerHTML = `<div class="attention-empty">No overdue or missing-update items are currently detected for this selection.</div>`;
    return;
  }

  elements.attentionList.innerHTML = displayed.map((item) => `
    <article class="attention-item ${escapeHtml(cssStatus(item.status))}${item.allNoUpdate ? " no-move-attention" : ""}">
      <div class="attention-icon">${item.status === "at_risk" || item.status === "blocked" ? "!" : "…"}</div>
      <div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)} · ${escapeHtml(statusLabel(item.status))}</p>
      </div>
    </article>
  `).join("");
}

async function pollWorkbookVersion() {
  if (!state.workbookVersion) return;
  try {
    const version = await fetchJson("/api/version");
    if (version.version !== state.workbookVersion) {
      const currentFunction = state.data?.selection?.function;
      const currentYear = state.data?.selection?.year;
      await loadDashboard(currentFunction, currentYear, { silent: true, preserveTheme: true });
      showToast("Excel change detected — dashboard refreshed automatically.");
    }
  } catch (error) {
    setConnectionState(false, "Workbook connection issue", error.message);
  }
}

async function manualRefresh() {
  elements.refreshButton.classList.add("is-spinning");
  elements.refreshButton.disabled = true;
  try {
    await fetchJson("/api/refresh", { method: "POST" });
    await loadDashboard(state.data?.selection?.function, state.data?.selection?.year, { preserveTheme: true });
    showToast("Dashboard refreshed from the latest Excel save.");
  } catch (error) {
    showToast(`Refresh failed: ${error.message}`);
  } finally {
    elements.refreshButton.classList.remove("is-spinning");
    elements.refreshButton.disabled = false;
  }
}

function renderOverallView() {
  const data = state.data;
  if (!data || !data.functions || (!elements.protoTableBodyCol1 && !elements.protoTableBodyLeft)) return;

  const {
    totalActive,
    totalCompleted,
    totalNotStarted,
    totalActions,
    riskTotal,
  } = state.summaryMetrics || {
    totalActive: 0,
    totalCompleted: 0,
    totalNotStarted: 0,
    totalActions: 0,
    riskTotal: 0,
  };

  // Update overall view donut charts: OVERALL PORTFOLIO HEALTH = (totalActive + totalCompleted) / totalActions
  const healthPercent = totalActions ? Math.round(((totalActive + totalCompleted) / totalActions) * 100) : 0;
  const completionPercent = totalActions ? Math.round((totalCompleted / totalActions) * 100) : 0;
  const activePercent = totalActions ? Math.round((totalActive / totalActions) * 100) : 0;
  const triggerPercent = totalActions ? Math.round((totalNotStarted / totalActions) * 100) : 0;

  const donutHealthFg = document.getElementById("donutHealthFg");
  const donutHealthText = document.getElementById("donutHealthText");
  const donutHealthStatus = document.getElementById("donutHealthStatus");
  if (donutHealthFg) donutHealthFg.setAttribute("stroke-dasharray", `${healthPercent}, 100`);
  if (donutHealthText) donutHealthText.textContent = `${healthPercent}%`;
  if (donutHealthStatus) {
    if (healthPercent > 50) {
      donutHealthStatus.textContent = "Healthy";
      donutHealthStatus.className = "proto-donut-status healthy";
      if (donutHealthFg) donutHealthFg.style.stroke = "#2c9992"; // Green
    } else if (healthPercent >= 30) {
      donutHealthStatus.textContent = "Moderate";
      donutHealthStatus.className = "proto-donut-status warning";
      if (donutHealthFg) donutHealthFg.style.stroke = "#ec9b22"; // Yellow
    } else {
      donutHealthStatus.textContent = "Critical";
      donutHealthStatus.className = "proto-donut-status critical";
      if (donutHealthFg) donutHealthFg.style.stroke = "#e2525e"; // Red
    }
  }

  const donutCompletionFg = document.getElementById("donutCompletionFg");
  const donutCompletionText = document.getElementById("donutCompletionText");
  const donutCompletionStatus = document.getElementById("donutCompletionStatus");
  if (donutCompletionFg) donutCompletionFg.setAttribute("stroke-dasharray", `${completionPercent}, 100`);
  if (donutCompletionText) donutCompletionText.textContent = `${completionPercent}%`;
  if (donutCompletionStatus) {
    if (completionPercent > 50) {
      donutCompletionStatus.textContent = "Healthy";
      donutCompletionStatus.className = "proto-donut-status healthy";
      if (donutCompletionFg) donutCompletionFg.style.stroke = "#2c9992"; // Green
    } else if (completionPercent >= 30) {
      donutCompletionStatus.textContent = "Moderate";
      donutCompletionStatus.className = "proto-donut-status warning";
      if (donutCompletionFg) donutCompletionFg.style.stroke = "#ec9b22"; // Yellow
    } else {
      donutCompletionStatus.textContent = "Critical";
      donutCompletionStatus.className = "proto-donut-status critical";
      if (donutCompletionFg) donutCompletionFg.style.stroke = "#e2525e"; // Red
    }
  }

  const donutActiveFg = document.getElementById("donutActiveFg");
  const donutActiveText = document.getElementById("donutActiveText");
  const donutActiveStatus = document.getElementById("donutActiveStatus");
  if (donutActiveFg) donutActiveFg.setAttribute("stroke-dasharray", `${activePercent}, 100`);
  if (donutActiveText) donutActiveText.textContent = `${activePercent}%`;
  if (donutActiveStatus) {
    if (activePercent > 50) {
      donutActiveStatus.textContent = "Healthy";
      donutActiveStatus.className = "proto-donut-status healthy";
      if (donutActiveFg) donutActiveFg.style.stroke = "#2c9992"; // Green
    } else if (activePercent >= 30) {
      donutActiveStatus.textContent = "On Track";
      donutActiveStatus.className = "proto-donut-status warning";
      if (donutActiveFg) donutActiveFg.style.stroke = "#ec9b22"; // Yellow
    } else {
      donutActiveStatus.textContent = "Critical";
      donutActiveStatus.className = "proto-donut-status critical";
      if (donutActiveFg) donutActiveFg.style.stroke = "#e2525e"; // Red
    }
  }

  const distComplete = document.getElementById("distComplete");
  const distActive = document.getElementById("distActive");
  const distPending = document.getElementById("distPending");
  const distRisk = document.getElementById("distRisk");
  if (distComplete) distComplete.textContent = totalCompleted;
  if (distActive) distActive.textContent = totalActive - riskTotal;
  if (distPending) distPending.textContent = totalNotStarted;
  if (distRisk) distRisk.textContent = riskTotal;

  const renderRow = (func) => {
    const total = func.total_actions_count || 0;
    const completed = func.completed_count || 0;
    const progressPercent = func.progress_percent !== undefined && func.progress_percent !== null
      ? Math.round(func.progress_percent)
      : (total > 0 ? Math.round((completed / total) * 100) : 0);
    
    let statusStr = "DATA PENDING";
    let healthClass = "grey";
    let statusClass = "pending";
    
    if (total > 0) {
      if (completed === total) {
        statusStr = "COMPLETE";
        healthClass = "green";
        statusClass = "on-track";
      } else {
        statusStr = "ON TRACK";
        healthClass = "green";
        statusClass = "on-track";
      }
    }

    return `
      <tr data-function-name="${escapeHtml(func.name)}">
        <td style="font-weight: 800; color: var(--navy);">${escapeHtml(func.name)}</td>
        <td><span class="proto-status-label ${statusClass}">${statusStr}</span></td>
        <td>
          <div class="proto-progress-bar-wrap">
            <div class="proto-progress-bar">
              <div class="proto-progress-fill" style="width: ${progressPercent}%"></div>
              <div class="ship-icon-wrapper" style="left: ${progressPercent}%">
                <svg viewBox="0 0 20 20" class="ship-icon">
                  <path d="M 2 11 L 4 15 L 16 15 L 18 11 Z" fill="var(--navy)" />
                  <path d="M 5 7 L 13 7 L 12 11 L 6 11 Z" fill="#ffffff" stroke="var(--navy)" stroke-width="0.8" />
                  <line x1="9" y1="2" x2="9" y2="7" stroke="var(--navy)" stroke-width="0.8" />
                  <polygon points="9,2 12,3.5 9,5" fill="var(--red)" />
                </svg>
              </div>
            </div>
            <div class="proto-progress-percent-box">
              <span class="proto-progress-percent">${progressPercent}%</span>
              <span class="proto-progress-count">(${completed}/${total})</span>
            </div>
          </div>
        </td>
      </tr>
    `;
  };

  const totalFuncs = data.functions.length;
  const perCol = Math.ceil(totalFuncs / 4);
  const col1Funcs = data.functions.slice(0, perCol);
  const col2Funcs = data.functions.slice(perCol, perCol * 2);
  const col3Funcs = data.functions.slice(perCol * 2, perCol * 3);
  const col4Funcs = data.functions.slice(perCol * 3);

  if (elements.protoTableBodyCol1) elements.protoTableBodyCol1.innerHTML = col1Funcs.map(renderRow).join("");
  if (elements.protoTableBodyCol2) elements.protoTableBodyCol2.innerHTML = col2Funcs.map(renderRow).join("");
  if (elements.protoTableBodyCol3) elements.protoTableBodyCol3.innerHTML = col3Funcs.map(renderRow).join("");
  if (elements.protoTableBodyCol4) elements.protoTableBodyCol4.innerHTML = col4Funcs.map(renderRow).join("");



  // Render Cross-Functional Dependency Heatmap Matrix
  const heatmapData = data.dependency_heatmap;
  const heatmapWrapper = document.getElementById("heatmapTableWrapper");
  const topBlockersBanner = document.getElementById("topBlockersBanner");

  if (heatmapData && heatmapWrapper) {
    const suppCols = heatmapData.supporting_columns || [];
    const matrix = heatmapData.matrix || {};
    const topBlockers = heatmapData.top_blockers || [];

    if (topBlockersBanner) {
      if (topBlockers.length > 0) {
        const topText = topBlockers.map(b => `<span class="blocker-pill">🚫 <strong>${escapeHtml(b.function)}</strong> (${b.count} ${b.count === 1 ? 'project' : 'projects'} delayed)</span>`).join(" ");
        topBlockersBanner.innerHTML = `<span class="blockers-lbl">TOP SYSTEMIC BLOCKERS:</span> ${topText}`;
      } else {
        topBlockersBanner.innerHTML = `<span class="blockers-lbl-green">✅ NO CROSS-FUNCTIONAL BOTTLENECKS REPORTED</span>`;
      }
    }

    const thCols = suppCols.map(col => {
      return `
        <th>
          <div class="hm-header-cell">
            <span class="hm-header-name">${escapeHtml(col)}</span>
          </div>
        </th>
      `;
    }).join("");
    
    const rowsHtml = data.functions.map(func => {
      const targetName = func.name;
      const suppMap = matrix[targetName] || {};
      
      const cellsHtml = suppCols.map(suppName => {
        const cellData = suppMap[suppName];
        if (!cellData) {
          return `<td><span class="hm-cell hm-none">—</span></td>`;
        }
        
        const actionsCount = typeof cellData === "object" ? (cellData.actions_count || 1) : 1;
        const progressPercent = typeof cellData === "object" ? (cellData.progress_percent ?? 0) : 50;

        return `
          <td class="hm-tile-cell">
            <div class="hm-tile-box hm-tile-blue" title="${escapeHtml(targetName)} depends on ${escapeHtml(suppName)}: ${actionsCount} action items (${progressPercent}% completed)">
              <span class="hm-tile-number">${actionsCount}</span>
            </div>
          </td>
        `;
      }).join("");

      return `
        <tr>
          <td class="hm-target-name">${escapeHtml(targetName)}</td>
          ${cellsHtml}
        </tr>
      `;
    }).join("");

    heatmapWrapper.innerHTML = `
      <table class="proto-heatmap-table">
        <thead>
          <tr>
            <th class="hm-corner-header">Target Functions \\ Supporting Function</th>
            ${thCols}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  }

  // Render function detail cards
  if (elements.functionCardsGrid) {
    elements.functionCardsGrid.innerHTML = data.functions.map((func, funcIdx) => {
      const progressPercent = func.total_actions_count ? Math.round((func.completed_count / func.total_actions_count) * 100) : 0;
      const activeCount = func.active_count || 0;
      const completedCount = func.completed_count || 0;
      const rawRiskCount = func.risk_count || 0;
      const totalCount = func.total_actions_count || 0;
      const keyThemes = func.key_themes || [];

      const delayingFuncs = func.delaying_functions || [];
      const supportingFuncs = func.supporting_functions_status || [];
      const depCount = func.dependencies_count || 0;

      const atRiskInterdependencies = supportingFuncs.filter(s => s.status === 'at_risk' || s.status === 'blocked');
      const atRiskThemes = keyThemes.filter(kt => kt.status === 'at_risk' || kt.status === 'blocked');

      const depRiskNum = atRiskInterdependencies.length > 0 ? atRiskInterdependencies.length : delayingFuncs.length;
      const totalDisplayRiskCount = rawRiskCount > 0 ? rawRiskCount : depRiskNum;

      let topBadgesHtml = "";
      let gradientId = `fcGaugeGrad-${funcIdx}`;
      let gradStart = "#64748b";
      let gradEnd = "#94a3b8";

      const hasInterdependencyRisk = atRiskInterdependencies.length > 0 || delayingFuncs.length > 0;
      const hasThemeRisk = atRiskThemes.length > 0;
      const hasInternalRisk = rawRiskCount > 0;

      if (totalCount > 0) {
        if (completedCount === totalCount) {
          topBadgesHtml = `<span class="proto-status-label on-track">COMPLETE</span>`;
          gradStart = "#10b981";
          gradEnd = "#059669";
        } else {
          topBadgesHtml = `<span class="proto-status-label on-track">ON TRACK</span>`;
          gradStart = "#2c9992";
          gradEnd = "#157bb3";
        }
      } else {
        topBadgesHtml = `<span class="proto-status-label pending">DATA PENDING</span>`;
      }

      const keyThemesHtml = keyThemes.length > 0 
        ? keyThemes.map(kt => {
            const cleanName = cleanThemeName(kt.name);
            const prog = kt.progress !== null && kt.progress !== undefined ? `${kt.progress}%` : null;
            return `
              <li class="fc-theme-bullet">
                <span class="fc-bullet-dot ${escapeHtml(cssStatus(kt.status))}"></span>
                <span class="fc-theme-name" title="${escapeHtml(kt.name)}">${escapeHtml(cleanName)}</span>
                ${prog ? `<span class="fc-theme-prog">${prog}</span>` : ''}
              </li>
            `;
          }).join('')
        : `<li class="fc-theme-bullet fc-empty"><span class="fc-bullet-dot no-update"></span><span class="fc-theme-name">No key themes entered</span></li>`;

      return `
        <div class="function-card" data-function-name="${escapeHtml(func.name)}">
          <div class="function-card-top">
            <div class="function-card-title-group">
              <div class="function-card-name">${escapeHtml(func.name)}</div>
            </div>
            <div class="fc-top-badges">
              ${topBadgesHtml}
            </div>
          </div>

          <div class="function-card-key-themes">
            <div class="fc-themes-header">
              <span>Key Themes</span>
            </div>
            <ul class="fc-themes-list">
              ${keyThemesHtml}
            </ul>
          </div>

          <div class="function-card-body-grid">
            <!-- Left Column: Computer Monitor Screen Infographic (% Loading...) -->
            <div class="fc-body-left">
              <div class="computer-screen-wrapper">
                <svg viewBox="0 0 160 100" class="computer-screen-svg" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                  <defs>
                    <linearGradient id="screenGrad-${funcIdx}" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#0f172a" />
                      <stop offset="100%" stop-color="#1e293b" />
                    </linearGradient>
                    <linearGradient id="loadBarGrad-${funcIdx}" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#38bdf8" />
                      <stop offset="100%" stop-color="#2563eb" />
                    </linearGradient>
                  </defs>

                  <!-- Computer Stand Base & Neck (Sleek Black Body) -->
                  <path d="M 65 88 L 95 88 L 100 96 L 60 96 Z" fill="#1e293b" />
                  <rect x="74" y="78" width="12" height="12" fill="#0f172a" />

                  <!-- Computer Outer Bezel Frame (Ultra-Thin Black Bezel) -->
                  <rect x="12" y="8" width="136" height="70" rx="4" fill="#0f172a" stroke="#1e293b" stroke-width="1" />

                  <!-- Display Screen Area (Soft Light Blue Background) -->
                  <rect x="14" y="10" width="132" height="66" rx="4" fill="#f0f9ff" stroke="#bae6fd" stroke-width="1" />

                  <!-- Window Header Dots -->
                  <circle cx="20" cy="16" r="1.8" fill="#ef4444" />
                  <circle cx="25" cy="16" r="1.8" fill="#f59e0b" />
                  <circle cx="30" cy="16" r="1.8" fill="#10b981" />

                  <!-- Center Percentage Readout Only -->
                  <text x="70" y="42" font-size="16" font-weight="900" fill="var(--navy)" text-anchor="middle" letter-spacing="-0.02em">${progressPercent}%</text>

                  <!-- Loading Bar Track Background -->
                  <rect x="25" y="52" width="90" height="6" fill="#e2e8f0" rx="3" />

                  <!-- Dynamic Progress Bar Fill -->
                  <rect x="25" y="52" width="${Math.max(4, Math.round(90 * (progressPercent / 100)))}" height="6" fill="url(#loadBarGrad-${funcIdx})" rx="3" />
                </svg>
              </div>
            </div>

            <!-- Right Column: Semi-Radar Gauge (Numbers on Diagram Arc & Cleaned Legend) -->
            <div class="fc-body-right">
              <div class="semi-radar-wrapper">
                ${(() => {
                  const total = totalCount || 0;
                  const comp = completedCount || 0;
                  const act = activeCount || 0;
                  const notStarted = Math.max(0, total - (comp + act));

                  const c = total > 0 ? (comp / total) : 0;
                  const a = total > 0 ? (act / total) : 0;
                  const n = total > 0 ? (notStarted / total) : (total === 0 ? 1 : 0);

                  const len = 125.66; // perimeter of r=40 semi-circle
                  const greenLen = (c * len).toFixed(1);
                  const yellowLen = (a * len).toFixed(1);
                  const greyLen = (n * len).toFixed(1);

                  const yellowOffset = (c * len).toFixed(1);
                  const greyOffset = ((c + a) * len).toFixed(1);

                  // Needle angle calculation pointing to completed action items (-90deg at 0%, 0deg at 50%, +90deg at 100%)
                  const completedPercent = total > 0 ? (comp / total) * 100 : 0;
                  const needleAngle = -90 + (completedPercent / 100) * 180;

                  // Label coordinates outside the arc segments for clear visibility on white background:
                  // Green arc (starts at 180deg left, extends clockwise by c*180deg)
                  const greenMidAngle = 180 - (c * 90);
                  const greenRad = (greenMidAngle * Math.PI) / 180;
                  const greenNumX = (60 + 50.5 * Math.cos(greenRad)).toFixed(1);
                  const greenNumY = (60 - 50.5 * Math.sin(greenRad)).toFixed(1);

                  // Yellow arc (starts at 180 - c*180deg, extends clockwise by a*180deg)
                  const yellowMidAngle = 180 - (c * 180 + a * 90);
                  const yellowRad = (yellowMidAngle * Math.PI) / 180;
                  const yellowNumX = (60 + 50.5 * Math.cos(yellowRad)).toFixed(1);
                  const yellowNumY = (60 - 50.5 * Math.sin(yellowRad)).toFixed(1);

                  return `
                    <div class="radar-chart-stage">
                      <svg viewBox="0 0 120 68" class="semi-radar-svg" aria-hidden="true">
                        <!-- Track Arc Background -->
                        <path d="M 20 60 A 40 40 0 0 1 100 60" fill="none" stroke="#f1f5f9" stroke-width="10" />

                        ${total > 0 ? `
                          <!-- Not Started Arc (Grey) -->
                          ${n > 0 ? `
                            <path d="M 20 60 A 40 40 0 0 1 100 60" fill="none" stroke="#cbd5e1" stroke-width="10"
                                  stroke-dasharray="${greyLen} 200" stroke-dashoffset="-${greyOffset}" stroke-linecap="butt" />
                          ` : ''}

                          <!-- In Progress Arc (Yellow) -->
                          ${a > 0 ? `
                            <path d="M 20 60 A 40 40 0 0 1 100 60" fill="none" stroke="#f59e0b" stroke-width="10"
                                  stroke-dasharray="${yellowLen} 200" stroke-dashoffset="-${yellowOffset}" stroke-linecap="butt" />
                          ` : ''}

                          <!-- Completed Arc (Green) -->
                          ${c > 0 ? `
                            <path d="M 20 60 A 40 40 0 0 1 100 60" fill="none" stroke="#10b981" stroke-width="10"
                                  stroke-dasharray="${greenLen} 200" stroke-dashoffset="0" stroke-linecap="round" />
                          ` : ''}

                          <!-- Action Numbers Outside The Diagram Arc for Maximum Legibility! -->
                          ${comp > 0 ? `
                            <text x="${greenNumX}" y="${greenNumY}" font-size="9" font-weight="900" fill="#059669" text-anchor="middle">${comp}</text>
                          ` : ''}
                          ${act > 0 ? `
                            <text x="${yellowNumX}" y="${yellowNumY}" font-size="9" font-weight="900" fill="#d97706" text-anchor="middle">${act}</text>
                          ` : ''}
                        ` : `
                          <!-- Empty Data Arc -->
                          <path d="M 20 60 A 40 40 0 0 1 100 60" fill="none" stroke="#e2e8f0" stroke-width="10" stroke-linecap="round" />
                        `}

                        <!-- Semi Radar Center Total Readout -->
                        <text x="60" y="47" font-size="10" font-weight="900" fill="var(--navy)" text-anchor="middle">${total}</text>
                        <text x="60" y="55" font-size="5.5" font-weight="800" fill="#64748b" text-anchor="middle">ACTIONS</text>

                        <!-- Rotating Needle Pointer Group pointing to Completed Action Items -->
                        <g class="semi-radar-needle-group" style="transform: rotate(${needleAngle}deg); transform-origin: 60px 60px;">
                          <line x1="60" y1="60" x2="60" y2="24" stroke="var(--navy)" stroke-width="1.8" stroke-linecap="round" />
                          <polygon points="58.8,60 61.2,60 60,21" fill="var(--navy)" />
                          <circle cx="60" cy="60" r="3.8" fill="#fbc02d" stroke="var(--navy)" stroke-width="1.4" />
                          <circle cx="60" cy="60" r="1.2" fill="#ffffff" />
                        </g>
                      </svg>
                    </div>

                    <!-- Clean Legend Below (Dots & Status Words Only, No Numbers) -->
                    <div class="radar-legend-grid">
                      <div class="radar-legend-item green">
                        <span class="legend-dot green"></span>
                        <span class="legend-lbl green">Completed</span>
                      </div>
                      <div class="radar-legend-item yellow">
                        <span class="legend-dot yellow"></span>
                        <span class="legend-lbl yellow">In Progress</span>
                      </div>
                      <div class="radar-legend-item grey is-centered-bottom">
                        <span class="legend-dot grey"></span>
                        <span class="legend-lbl grey">Not Started</span>
                      </div>
                    </div>
                  `;
                })()}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    elements.functionCardsGrid.querySelectorAll(".function-card").forEach((card) => {
      card.addEventListener("click", () => {
        const funcName = card.dataset.functionName;
        state.viewMode = "detail";
        loadDashboard(funcName, state.data?.selection?.year, { preserveTheme: false });
      });
    });
  }
}

function toggleViewMode() {
  const isOverall = state.viewMode === "overall";
  if (elements.overallSection) elements.overallSection.classList.toggle("is-hidden", !isOverall);
  if (elements.detailViewContainer) elements.detailViewContainer.classList.toggle("is-hidden", isOverall);
  if (elements.backToOverallBtn) elements.backToOverallBtn.classList.toggle("is-hidden", isOverall);

  const bulletTrainCard = document.getElementById("bulletTrainSummaryCard");
  if (bulletTrainCard) bulletTrainCard.classList.toggle("is-hidden", !isOverall);

  // Hide function filter control when in overall view
  const functionFilterControl = elements.functionSelect?.closest(".filter-control");
  if (functionFilterControl) {
    functionFilterControl.classList.toggle("is-hidden", isOverall);
  }

  // Always show year filter control
  const yearFilterControl = elements.yearSegment?.closest(".filter-control");
  if (yearFilterControl) {
    yearFilterControl.classList.remove("is-hidden");
  }


  if (isOverall) {
    elements.selectionCaption.innerHTML = `Viewing <strong>Overall VCP Overview</strong><br>${state.data?.selection?.year || "All"} execution year`;
  }
}

function bindEvents() {
  elements.functionSelect.addEventListener("change", (event) => {
    if (event.target.value === "_all_") {
      state.viewMode = "overall";
      loadDashboard(null, state.data?.selection?.year, { preserveTheme: false });
    } else {
      state.viewMode = "detail";
      loadDashboard(event.target.value, null, { preserveTheme: false });
    }
  });

  elements.yearSegment.addEventListener("click", (event) => {
    const button = event.target.closest("[data-year]");
    if (!button) return;
    const year = Number(button.dataset.year);
    if (state.viewMode === "overall") {
      loadDashboard(null, year, { preserveTheme: false });
    } else {
      loadDashboard(state.data?.selection?.function, year, { preserveTheme: false });
    }
  });

  elements.themeTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-id]");
    if (!button) return;
    selectTheme(button.dataset.themeId);
  });

  elements.refreshButton.addEventListener("click", manualRefresh);

  if (elements.backToOverallBtn) {
    elements.backToOverallBtn.addEventListener("click", () => {
      state.viewMode = "overall";
      loadDashboard(null, state.data?.selection?.year, { preserveTheme: false });
    });
  }

  // One-Pager Modal & Export Handlers
  const onePagerBtn = document.getElementById("onePagerButton");
  const onePagerModal = document.getElementById("onePagerModal");
  const closeOnePagerModal = document.getElementById("closeOnePagerModal");
  const downloadPngBtn = document.getElementById("downloadPngBtn");
  const copyEmailHtmlBtn = document.getElementById("copyEmailHtmlBtn");
  const downloadHtmlBtn = document.getElementById("downloadHtmlBtn");
  const printPdfBtn = document.getElementById("printPdfBtn");
  const previewStatus = document.getElementById("previewStatus");

  if (onePagerBtn && onePagerModal) {
    onePagerBtn.addEventListener("click", () => {
      if (state.viewMode !== "overall") {
        state.viewMode = "overall";
        renderView();
      }
      onePagerModal.classList.remove("is-hidden");
    });
  }

  if (closeOnePagerModal && onePagerModal) {
    closeOnePagerModal.addEventListener("click", () => {
      onePagerModal.classList.add("is-hidden");
    });

    onePagerModal.addEventListener("click", (e) => {
      if (e.target === onePagerModal) {
        onePagerModal.classList.add("is-hidden");
      }
    });
  }

  if (downloadPngBtn) {
    downloadPngBtn.addEventListener("click", async () => {
      const dashboardShell = document.getElementById("dashboardShell");
      if (!dashboardShell) return;

      downloadPngBtn.disabled = true;
      downloadPngBtn.innerText = "Capturing 4K PNG...";
      if (previewStatus) previewStatus.innerText = "Rendering full executive dashboard PNG canvas...";

      try {
        if (window.html2canvas) {
          const canvas = await window.html2canvas(dashboardShell, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#f4f7fb",
            logging: false,
            windowWidth: 1400,
            ignoreElements: (el) => el.classList && el.classList.contains("no-export")
          });

          const dataUrl = canvas.toDataURL("image/png");
          
          // Send to FastAPI backend endpoint to write directly to Downloads and save to static exports
          const response = await fetch("/api/save-one-pager-png", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image: dataUrl,
              year: state.data?.selection?.year || '2026'
            })
          });

          if (!response.ok) {
            throw new Error("Server PNG export failed");
          }

          const resData = await response.json();
          const fileName = resData.filename || `VCP_Executive_OnePager_${state.data?.selection?.year || '2026'}.png`;
          const imgUrl = resData.url;

          // Trigger browser direct file download from real server URL
          const link = document.createElement("a");
          link.style.display = "none";
          link.href = imgUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            document.body.removeChild(link);
          }, 2000);

          // Automatically open the PNG in a new browser tab so user can view/inspect immediately
          window.open(imgUrl, "_blank");

          showToast("📸 Executive One-Pager PNG generated & opened in new tab!");
          if (previewStatus) previewStatus.innerText = "✅ PNG poster saved to Downloads & opened: " + fileName;
        } else {
          window.print();
        }
      } catch (err) {
        console.error("PNG export error:", err);
        showToast("⚠️ Standard print fallback initiated");
        window.print();
      } finally {
        downloadPngBtn.disabled = false;
        downloadPngBtn.innerText = "Download PNG";
      }
    });
  }

  if (copyEmailHtmlBtn) {
    copyEmailHtmlBtn.addEventListener("click", () => {
      const currentUrl = window.location.href;
      const emailHtml = `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 900px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
  <div style="background: linear-gradient(115deg, #0e274b, #164a74 55%, #228089); padding: 24px 32px; color: #ffffff;">
    <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: -0.02em;">VCP Execution Dashboard — Executive One-Pager</h1>
    <p style="margin: 6px 0 0; color: rgba(255,255,255,0.8); font-size: 13px;">Value Creation Plan Execution & Cross-Functional Blocker Matrix</p>
  </div>
  
  <div style="padding: 24px 32px; background: #f4f7fb;">
    <div style="background: #ffffff; border-radius: 12px; border: 1px solid #cbd5e1; padding: 20px; text-align: center; margin-bottom: 20px;">
      <h2 style="margin: 0 0 10px; color: #1b365d; font-size: 18px;">📊 Interactive Live Executive Dashboard</h2>
      <p style="margin: 0 0 16px; color: #64748b; font-size: 13px;">View real-time gauge meters, status animations, and cross-functional blockers live in browser.</p>
      <a href="${currentUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; background: #1b365d; color: #ffffff; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 12px rgba(27,54,93,0.2);">👉 Open Live Interactive One-Pager</a>
    </div>

    <div style="font-size: 12px; color: #64748b; text-align: center;">
      <span>Generated automatically from VCP Live Execution Store • Selection Year: ${state.data?.selection?.year || '2026'}</span>
    </div>
  </div>
</div>`;

      navigator.clipboard.writeText(emailHtml).then(() => {
        showToast("📧 Email poster snippet copied to clipboard! Paste into Outlook/Gmail body.");
        if (previewStatus) previewStatus.innerText = "✅ Email HTML poster snippet copied to clipboard";
      }).catch(err => {
        showToast("⚠️ Copied link to dashboard!");
        navigator.clipboard.writeText(currentUrl);
      });
    });
  }

  if (downloadHtmlBtn) {
    downloadHtmlBtn.addEventListener("click", () => {
      const pageHtml = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
      const blob = new Blob([pageHtml], { type: "text/html" });
      const link = document.createElement("a");
      link.download = `VCP_Executive_OnePager_Interactive_${state.data?.selection?.year || '2026'}.html`;
      link.href = URL.createObjectURL(blob);
      link.click();

      showToast("🌐 Standalone interactive HTML file downloaded!");
      if (previewStatus) previewStatus.innerText = "✅ Standalone interactive HTML file ready";
    });
  }

  if (printPdfBtn) {
    printPdfBtn.addEventListener("click", () => {
      window.print();
    });
  }
}

async function initialise() {
  bindEvents();
  let savedFunction = null;
  let savedYear = null;
  try {
    savedFunction = localStorage.getItem("vcp-dashboard-function");
    savedYear = localStorage.getItem("vcp-dashboard-year");
  } catch (_) {
    // Ignore blocked storage.
  }

  if (savedFunction === "_all_" || !savedFunction) {
    state.viewMode = "overall";
    await loadDashboard(null, null, { preserveTheme: false });
  } else {
    state.viewMode = "detail";
    await loadDashboard(savedFunction, savedYear ? Number(savedYear) : null, { preserveTheme: false });
  }
  state.pollTimer = window.setInterval(pollWorkbookVersion, 15000);
}

initialise();
