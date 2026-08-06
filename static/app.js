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
  totalThemesNote: document.getElementById("totalThemesNote"),
  activeActionItemsNote: document.getElementById("activeActionItemsNote"),
  completedActionItemsNote: document.getElementById("completedActionItemsNote"),
  notStartedActionItemsNote: document.getElementById("notStartedActionItemsNote"),
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
  overallGrid: document.getElementById("overallGrid"),
  detailViewContainer: document.getElementById("detailViewContainer"),
  backToOverallBtn: document.getElementById("backToOverallBtn"),
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
  if (!silent) showLoading(true);

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
      const suffix = item.theme_count ? ` · ${item.theme_count} themes` : " · no themes entered";
      return `<option value="${escapeHtml(item.name)}"${selected}>${escapeHtml(item.name + suffix)}</option>`;
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
  elements.totalThemes.textContent = themes.length;

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

  elements.activeActionItems.textContent = totalActive;
  elements.completedActionItems.textContent = totalCompleted;
  elements.notStartedActionItems.textContent = totalNotStarted;

  elements.totalThemesNote.textContent = `Across all ${themes.length} key themes`;
  
  const riskLabel = atRiskCount + blockedCount;
  elements.activeActionItemsNote.textContent = riskLabel ? `${riskLabel} active item${riskLabel === 1 ? "" : "s"} at risk/blocked` : "Actions currently in progress";
  
  const totalActions = totalCompleted + totalActive + totalNotStarted;
  elements.completedActionItemsNote.textContent = `${totalActions ? Math.round((totalCompleted / totalActions) * 100) : 0}% completion rate`;
  
  elements.notStartedActionItemsNote.textContent = "Awaiting execution trigger";
}

function renderThemeTabs() {
  const themes = state.data.themes || [];
  elements.themeTabs.innerHTML = themes
    .map((theme) => `
      <button type="button" role="tab" class="theme-tab${theme.id === state.selectedThemeId ? " is-active" : ""}"
        data-theme-id="${escapeHtml(theme.id)}" aria-selected="${theme.id === state.selectedThemeId}" title="${escapeHtml(theme.name)}">
        ${escapeHtml(truncate(theme.name, 48))}
      </button>
    `)
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
  if (!data || !data.functions || !elements.overallGrid) return;

  elements.overallGrid.innerHTML = data.functions
    .map((func) => {
      const themeCountText = func.theme_count === 1 ? "1 key theme" : `${func.theme_count} key themes`;
      const hasThemesClass = func.theme_count > 0 ? "has-themes" : "";
      const countClass = func.theme_count > 0 ? "" : " zero";
      const yearsList = func.years && func.years.length ? func.years.join(", ") : "None";
      
      return `
        <div class="function-card ${hasThemesClass}" data-function-name="${escapeHtml(func.name)}" tabindex="0" role="button">
          <div class="function-card-header">
            <h3>${escapeHtml(func.name)}</h3>
          </div>
          <div class="function-card-body">
            <span class="function-themes-count${countClass}">${func.theme_count}</span>
            <span style="font-size:12px;color:var(--ink-soft);">${themeCountText}</span>
          </div>
          <div class="function-card-footer">
            <span>Years: ${escapeHtml(yearsList)}</span>
            <span style="color:var(--blue);font-weight:750;">View detail &rarr;</span>
          </div>
        </div>
      `;
    })
    .join("");

  elements.overallGrid.querySelectorAll(".function-card").forEach((card) => {
    const activate = () => {
      const funcName = card.dataset.functionName;
      state.viewMode = "detail";
      loadDashboard(funcName, null, { preserveTheme: false });
    };
    card.addEventListener("click", activate);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
  });
}

function toggleViewMode() {
  const isOverall = state.viewMode === "overall";
  if (elements.overallSection) elements.overallSection.classList.toggle("is-hidden", !isOverall);
  if (elements.detailViewContainer) elements.detailViewContainer.classList.toggle("is-hidden", isOverall);
  if (elements.backToOverallBtn) elements.backToOverallBtn.classList.toggle("is-hidden", isOverall);

  const yearFilterControl = elements.yearSegment?.closest(".filter-control");
  if (yearFilterControl) {
    yearFilterControl.classList.toggle("is-hidden", isOverall);
  }
  
  if (isOverall) {
    elements.selectionCaption.innerHTML = "Viewing <strong>Overall VCP Overview</strong><br>All execution functions";
  }
}

function bindEvents() {
  elements.functionSelect.addEventListener("change", (event) => {
    if (event.target.value === "_all_") {
      state.viewMode = "overall";
      renderDashboard();
      saveSelection();
    } else {
      state.viewMode = "detail";
      loadDashboard(event.target.value, null, { preserveTheme: false });
    }
  });

  elements.yearSegment.addEventListener("click", (event) => {
    const button = event.target.closest("[data-year]");
    if (!button) return;
    loadDashboard(state.data?.selection?.function, Number(button.dataset.year), { preserveTheme: false });
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
      renderDashboard();
      saveSelection();
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
