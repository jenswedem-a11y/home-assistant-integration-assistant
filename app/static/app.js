const tree = JSON.parse(document.getElementById("treeData").textContent);
const i18n = JSON.parse(document.getElementById("i18nData").textContent);
const appConfig = JSON.parse(document.getElementById("appConfig").textContent);

function t(key, params = {}) {
  const text = i18n.strings[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? params[name] : match));
}

function tn(key, count, params = {}) {
  return t(`${key}.${count === 1 ? "one" : "other"}`, { count, ...params });
}

const icons = {
  lightbulb:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.74V16h8v-1.26A7 7 0 0 0 12 2Z"/></svg>',
  tv:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>',
  radio:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.9 19.1a10 10 0 1 1 14.2 0"/><path d="M7.8 16.2a6 6 0 1 1 8.4 0"/><circle cx="12" cy="12" r="2"/></svg>',
  gauge:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14a8 8 0 1 1 16 0"/><path d="M12 14l4-4"/><path d="M6.5 19h11"/></svg>',
  plug:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M6 8h12v4a6 6 0 0 1-12 0Z"/></svg>',
  thermostat:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 14.76V5a4 4 0 0 0-8 0v9.76a6 6 0 1 0 8 0Z"/><path d="M10 9h8"/><path d="M10 5h6"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
  alert:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 3.4 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.4a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  clock:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  route:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M12 19h2a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h2"/></svg>',
  qr:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h2v2h-2z"/><path d="M19 14h2v5h-5v-2"/><path d="M14 19h2v2h-2z"/></svg>',
  refresh:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 0 1-15.5 6.3"/><path d="M3 12A9 9 0 0 1 18.5 5.7"/><path d="M3 18v-5h5"/><path d="M21 6v5h-5"/></svg>',
  "arrow-left":
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
  "arrow-right":
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
};

const steps = ["category", "manufacturer", "model", "connection", "infrastructure", "result"].map((id) => ({
  id,
  title: t(`step.${id}.title`),
  body: t(`step.${id}.body`),
}));

const state = {
  category: tree.categories[0].id,
  manufacturer: "",
  model: "",
  connection: "",
  infrastructureAnswers: {},
  selectedKnowledgeDevice: null,
  selectedKnowledgeDetails: null,
  liveHaStatus: null,
  liveCapabilities: null,
  pairing: {
    ready: false,
    phase: "idle",
    message: "",
    homeAssistantUrl: "",
  },
};

const knowledgeWizard = {
  vendors: null,
  vendorsError: "",
  devicesByVendor: {},
  devicesErrorByVendor: {},
  modelFilter: "",
};

let currentStep = 0;
let hasStarted = false;

const startPanel = document.getElementById("startPanel");
const manualStartBtn = document.getElementById("manualStartBtn");
const haAnalysisState = document.getElementById("haAnalysisState");
const deviceSearchForm = document.getElementById("deviceSearchForm");
const deviceSearchInput = document.getElementById("deviceSearchInput");
const deviceSearchStatus = document.getElementById("deviceSearchStatus");
const deviceSearchResults = document.getElementById("deviceSearchResults");
const deviceDetailPanel = document.getElementById("deviceDetailPanel");
const categoryIcon = document.getElementById("categoryIcon");
const questionTitle = document.getElementById("questionTitle");
const questionBody = document.getElementById("questionBody");
const stepCounter = document.getElementById("stepCounter");
const progressLabel = document.getElementById("progressLabel");
const progressBar = document.getElementById("progressBar");
const questionCard = document.getElementById("questionCard");
const answerList = document.getElementById("answerList");
const stepList = document.getElementById("stepList");
const prevBtn = document.getElementById("prevBtn");
const resetBtn = document.getElementById("resetBtn");
const nextBtn = document.getElementById("nextBtn");

function currentCategory() {
  return tree.categories.find((category) => category.id === state.category) || tree.categories[0];
}

function hydrateIcons() {
  document.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = icons[node.dataset.icon] || "";
  });
}

function renderHaAnalysis(result) {
  if (!haAnalysisState) return;

  if (!result.ok) {
    haAnalysisState.className = "analysis-state error";
    haAnalysisState.innerHTML = `
      <div class="analysis-error">
        <span class="analysis-symbol">${icons.alert}</span>
        <strong>${result.error}</strong>
        ${result.needs_connection && !appConfig.managed_connection ? renderConnectionFormMarkup(result.default_url) : ""}
      </div>
    `;
    bindConnectionForm();
    return;
  }

  const analysis = result.analysis;
  const translated = analysis.translator || {};

  state.liveHaStatus = result.ha_status || null;
  state.liveCapabilities = result.capabilities || null;

  haAnalysisState.className = "analysis-state success";
  haAnalysisState.innerHTML = `
    <div class="analysis-connected">
      <div class="connection-status">
        <span>${icons.check}</span>
        <div>
          <strong>${t("analysis.connected")}</strong>
          <small>${t("analysis.last_scan", { time: formatAnalysisTime(analysis.scanned_at) })}</small>
        </div>
        ${appConfig.managed_connection ? "" : `<button class="secondary" type="button" id="changeConnectionBtn">${t("analysis.change_connection")}</button>`}
      </div>
      <h3 class="recognition-title">${t("analysis.recognized_title")}</h3>
      <div class="simple-insights">
        ${renderCapabilitySection(translated.capabilities || [])}
        ${renderRealDeviceSection(translated.real_devices || {}, translated.integrations || {})}
        ${renderFoundationSection(translated.integrations || {})}
      </div>
      <div class="next-suggestion">
        <h3>${t("analysis.next_step_title")}</h3>
        <p>${buildTranslatedNextStep(translated)}</p>
        ${analysis.home_assistant_url ? `<a class="ha-link" href="${analysis.home_assistant_url}" target="_blank" rel="noreferrer">${t("common.open_in_ha")}</a>` : ""}
      </div>
      <details class="advanced-details">
        <summary>${t("common.show_technical_details")}</summary>
        <div class="technical-summary">
          ${renderTechnicalEntities(translated)}
          ${renderLegacyGroups(analysis, analysis.home_assistant_url)}
        </div>
      </details>
    </div>
  `;
  bindAnalysisDetails();
  if (hasStarted) render();
}

function renderCapabilitySection(capabilities) {
  const items = capabilities.length ? capabilities.map((key) => t(`capability.${key}`)) : [t("analysis.no_capabilities")];
  return `
    <section class="insight-section">
      <h4>${t("analysis.capabilities_title")}</h4>
      ${items.map((item) => renderInsightLine(item, capabilities.length ? "ok" : "unknown")).join("")}
    </section>
  `;
}

function renderRealDeviceSection(realDevices, integrations) {
  const rows = [
    [tn("analysis.lights", realDevices.lights?.length || 0), realDevices.lights?.length > 0],
    [`${tn("analysis.tvs", realDevices.tvs?.length || 0)}${integrations.android_tv ? ` · ${t("analysis.android_tv_detected")}` : ""}`, realDevices.tvs?.length > 0],
    [tn("analysis.echo", realDevices.echo_devices?.length || 0), realDevices.echo_devices?.length > 0],
    [tn("analysis.phones", realDevices.mobile_devices?.length || 0), realDevices.mobile_devices?.length > 0],
  ];
  return `
    <section class="insight-section">
      <h4>${t("analysis.devices_title")}</h4>
      ${rows.map(([label, ok]) => renderInsightLine(label, ok ? "ok" : "unknown")).join("")}
    </section>
  `;
}

function renderFoundationSection(integrations) {
  return `
    <section class="insight-section">
      <h4>${t("analysis.foundations_title")}</h4>
      ${renderInsightLine(`Zigbee: ${translateAnalysisValue(integrations.zigbee)}`, "unknown")}
      ${renderInsightLine(`MQTT: ${translateAnalysisValue(integrations.mqtt)}`, "unknown")}
      ${renderInsightLine(`Matter: ${translateAnalysisValue(integrations.matter)}`, "unknown")}
      ${renderInsightLine(`Thread: ${translateAnalysisValue(integrations.thread)}`, "unknown")}
    </section>
  `;
}

function renderInsightLine(label, state) {
  return `
    <div class="simple-insight ${state}">
      <span>${state === "ok" ? icons.check : icons.clock}</span>
      <div>
        <strong>${label}</strong>
      </div>
    </div>
  `;
}

function renderTechnicalEntities(translated) {
  const tech = translated.technical_entities || {};
  const sensorGroups = translated.sensor_groups || {};
  const rows = [
    [t("tech.backup"), tech.backup_sensors?.length || 0],
    [t("tech.weather_sun"), (tech.sun_sensors?.length || 0) + (tech.weather_sensors?.length || 0)],
    [t("tech.system"), tech.system_sensors?.length || 0],
    [t("tech.alexa_visible"), tech.alexa_visible_devices?.length || 0],
    [t("tech.climate"), sensorGroups.climate_environment?.length || 0],
    [t("tech.motion"), sensorGroups.motion_presence?.length || 0],
    [t("tech.energy"), sensorGroups.energy?.length || 0],
    [t("tech.smartphone"), sensorGroups.smartphone?.length || 0],
    [t("tech.other_sensors"), sensorGroups.other?.length || 0],
  ];
  return `
    <section class="technical-block">
      <h4>${t("tech.title")}</h4>
      ${rows
        .filter(([, count]) => count > 0)
        .map(([label, count]) => renderInsightLine(`${label} (${count})`, "ok"))
        .join("") || renderInsightLine(t("tech.none"), "unknown")}
    </section>
  `;
}

function renderLegacyGroups(analysis, homeAssistantUrl) {
  const groups = Object.entries(analysis.groups || {}).filter(([, group]) => (group.count || 0) > 0);
  return `<div class="analysis-groups">${groups.map(([key, group]) => renderAnalysisGroup(key, group, homeAssistantUrl)).join("")}</div>`;
}

function buildTranslatedNextStep(translated) {
  const integrations = translated.integrations || {};
  if ([integrations.zigbee, integrations.mqtt, integrations.matter, integrations.thread].some((value) => value === "unknown")) {
    return t("analysis.next.check_foundations");
  }
  if ((translated.capabilities || []).length > 0) {
    return t("analysis.next.choose_device");
  }
  return t("analysis.next.manual_start");
}

function renderAnalysisGroup(key, group, homeAssistantUrl) {
  const examples = group.examples?.length
    ? group.examples.map((name) => `<li>${name}</li>`).join("")
    : `<li>${t("analysis.no_devices")}</li>`;
  const entities = (group.entities || [])
    .map(
      (entity) => `
        <tr>
          <td>${entity.name}</td>
          <td><code>${entity.entity_id}</code></td>
          <td>${entity.status}</td>
          <td>${entity.area || t("common.unknown")}</td>
        </tr>
      `
    )
    .join("");
  return `
    <section class="analysis-group" data-group="${key}">
      <div class="analysis-group-head">
        <h3>${t(`group.${key}`)} (${group.count || 0})</h3>
        <button class="secondary details-toggle" type="button" data-target="${key}">${t("common.show_technical_details")}</button>
      </div>
      <ul>${examples}</ul>
      <div class="analysis-details hidden" id="details-${key}">
        <table>
          <thead><tr><th>${t("table.name")}</th><th>Entity ID</th><th>${t("table.status")}</th><th>${t("table.area")}</th></tr></thead>
          <tbody>${entities || `<tr><td colspan="4">${t("table.no_entities")}</td></tr>`}</tbody>
        </table>
        ${homeAssistantUrl ? `<a class="ha-link" href="${homeAssistantUrl}" target="_blank" rel="noreferrer">${t("common.open_in_ha")}</a>` : ""}
      </div>
    </section>
  `;
}

function bindAnalysisDetails() {
  const changeButton = document.getElementById("changeConnectionBtn");
  if (changeButton) {
    changeButton.addEventListener("click", async () => {
      state.liveHaStatus = null;
      state.liveCapabilities = null;
      const response = await fetch("api/home-assistant-token-status");
      const status = await response.json();
      renderHaAnalysis({
        ok: false,
        error: t("connection.change_title"),
        needs_connection: true,
        default_url: status.default_url,
        analysis: null,
      });
    });
  }

  document.querySelectorAll(".details-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = document.getElementById(`details-${button.dataset.target}`);
      if (!panel) return;
      panel.classList.toggle("hidden");
      button.textContent = panel.classList.contains("hidden") ? t("common.show_details") : t("common.hide_details");
    });
  });
}

function translateAnalysisValue(value) {
  if (value === "unknown") return t("value.unknown");
  if (value === true) return t("value.detected");
  if (value === false) return t("value.not_detected");
  return value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setSearchStatus(message, type = "") {
  if (!deviceSearchStatus) return;
  deviceSearchStatus.className = `device-search-status ${type}`.trim();
  deviceSearchStatus.textContent = message || "";
}

async function searchKnowledgeDevices(query) {
  if (!deviceSearchResults || !deviceDetailPanel) return;
  const trimmed = query.trim();
  if (!trimmed) {
    setSearchStatus(t("search.empty_query"), "muted");
    deviceSearchResults.innerHTML = "";
    deviceDetailPanel.classList.add("hidden");
    return;
  }

  setSearchStatus(t("search.searching"), "muted");
  deviceSearchResults.innerHTML = "";

  try {
    const response = await fetch(`devices/search?q=${encodeURIComponent(trimmed)}`);
    if (!response.ok) throw new Error(t("error.api_unreachable"));
    const result = await response.json();
    if (!result.ok) {
      setSearchStatus(result.error || t("error.api_unreachable"), "error");
      return;
    }
    renderSearchResults(result.items || []);
  } catch (error) {
    setSearchStatus(t("error.api_unreachable"), "error");
  }
}

function renderSearchResults(items) {
  if (!deviceSearchResults) return;
  if (!items.length) {
    setSearchStatus(t("search.no_results"), "empty");
    deviceSearchResults.innerHTML = "";
    return;
  }

  setSearchStatus(tn("search.results", items.length), "success");
  deviceSearchResults.innerHTML = items
    .map(
      (item) => `
        <button class="device-result" type="button" data-device-id="${item.device_id}">
          <span>
            <strong>${escapeHtml(item.vendor)} ${escapeHtml(item.model)}</strong>
            <small>${escapeHtml(item.display_name || t("device.no_display_name"))}</small>
          </span>
          <span class="device-meta">
            <em>${escapeHtml(item.protocol || t("common.unknown_lower"))}</em>
            <em>${escapeHtml(item.match_type ? t(`match.${item.match_type}`) : t("search.match"))}</em>
          </span>
        </button>
      `
    )
    .join("");

  deviceSearchResults.querySelectorAll(".device-result").forEach((button) => {
    button.addEventListener("click", () => loadDeviceDetails(button.dataset.deviceId));
  });
}

async function loadDeviceDetails(deviceId) {
  if (!deviceDetailPanel) return;
  deviceDetailPanel.classList.remove("hidden");
  deviceDetailPanel.innerHTML = `<div class="detail-loading"><span class="analysis-spinner"></span><strong>${t("device.loading_details")}</strong></div>`;

  try {
    const response = await fetch(`devices/${encodeURIComponent(deviceId)}`);
    if (!response.ok) throw new Error(t("error.api_unreachable"));
    const result = await response.json();
    if (!result.ok) {
      deviceDetailPanel.innerHTML = `<div class="device-detail-error">${escapeHtml(result.error || t("device.load_failed"))}</div>`;
      return;
    }
    state.selectedKnowledgeDevice = result.device;
    renderDeviceDetails(result);
    render();
  } catch (error) {
    deviceDetailPanel.innerHTML = `<div class="device-detail-error">${t("error.api_unreachable")}</div>`;
  }
}

function renderDeviceDetails(result) {
  const device = result.device || {};
  if (!deviceDetailPanel) return;
  deviceDetailPanel.innerHTML = `
    <div class="device-detail-head">
      <div>
        <p class="eyebrow">${t("device.selected")}</p>
        <h3>${escapeHtml(device.display_name || `${device.canonical_vendor} ${device.canonical_model}`)}</h3>
        <p>${escapeHtml(device.description || t("device.no_description"))}</p>
      </div>
      <span>${escapeHtml(device.protocol || t("common.unknown_lower"))}</span>
    </div>
    <div class="device-detail-grid">
      ${renderDetailList(t("device.variants"), result.variants || [], (item) => [
        item.variant_name,
        item.model_number,
        item.region,
      ])}
      ${renderDetailList(t("device.identifiers"), result.identifiers || [], (item) => [
        item.identifier_type,
        item.identifier_value,
        item.source,
      ])}
      ${renderDetailList(t("device.capabilities"), result.capabilities || [], (item) => [
        item.capability,
        summarizeCapability(item.value),
        item.source,
      ])}
      ${renderDetailList(t("device.compatibility"), result.compatibility || [], (item) => [
        item.platform,
        item.supported ? t("device.supported") : t("device.not_supported"),
        item.notes,
      ])}
    </div>
  `;
}

function renderDetailList(title, items, mapItem) {
  const rows = items.slice(0, 12).map((item) => {
    const values = mapItem(item).filter((value) => value !== null && value !== undefined && value !== "");
    return `<li>${values.map((value) => `<span>${escapeHtml(value)}</span>`).join("")}</li>`;
  });
  const more = items.length > 12 ? `<p>${tn("device.more_entries", items.length - 12)}</p>` : "";
  return `
    <section class="detail-section">
      <h4>${escapeHtml(title)} (${items.length})</h4>
      <ul>${rows.join("") || `<li><span>${t("device.no_data")}</span></li>`}</ul>
      ${more}
    </section>
  `;
}

function summarizeCapability(value) {
  if (!value) return "";
  const capability = typeof value === "string" ? JSON.parse(value) : value;
  return capability.property || capability.name || capability.type || JSON.stringify(capability).slice(0, 80);
}

function formatAnalysisTime(value) {
  if (!value) return t("time.just_now");
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return t("time.just_now");
  return new Intl.RelativeTimeFormat(i18n.lang, { numeric: "auto" }).format(-minutes, "minute");
}

function renderConnectionFormMarkup(defaultUrl = "http://homeassistant.local:8123") {
  return `
    <form class="token-form" id="haConnectionForm">
      <h3>${t("connection.title")}</h3>
      <label>
        <span>${t("connection.url")}</span>
        <input id="haUrlInput" type="url" autocomplete="url" value="${defaultUrl || "http://homeassistant.local:8123"}" placeholder="http://homeassistant.local:8123" />
      </label>
      <label>
        <span>${t("connection.token")}</span>
        <input id="haTokenInput" type="password" autocomplete="off" placeholder="${t("connection.token_placeholder")}" />
      </label>
      <button class="primary" type="submit">${t("connection.test")}</button>
      <small>${t("connection.hint")}</small>
    </form>
  `;
}

function bindConnectionForm() {
  const form = document.getElementById("haConnectionForm");
  const urlInput = document.getElementById("haUrlInput");
  const input = document.getElementById("haTokenInput");
  if (!form || !urlInput || !input) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = urlInput.value.trim();
    const token = input.value.trim();
    if (!url || !token) return;

    haAnalysisState.className = "analysis-state";
    haAnalysisState.innerHTML = `<span class="analysis-spinner"></span><strong>${t("analysis.running")}</strong>`;

    try {
      const response = await fetch("api/home-assistant-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, token }),
      });
      const result = await response.json();
      if (!result.ok) {
        renderHaAnalysis({
          ok: false,
          error: result.error || t("error.ha_not_connected"),
          needs_connection: true,
          default_url: url,
          analysis: null,
        });
        return;
      }
      await loadHomeAssistantAnalysis();
    } catch (error) {
      renderHaAnalysis({ ok: false, error: t("error.ha_unreachable"), needs_connection: true, default_url: url, analysis: null });
    }
  });
}

async function loadHomeAssistantAnalysis() {
  if (!haAnalysisState) return;
  haAnalysisState.className = "analysis-state";
  haAnalysisState.innerHTML = `<span class="analysis-spinner"></span><strong>${t("analysis.running")}</strong>`;
  try {
    const response = await fetch("api/home-assistant-scan");
    renderHaAnalysis(await response.json());
  } catch (error) {
    renderHaAnalysis({ ok: false, error: t("error.ha_unreachable"), needs_connection: false, analysis: null });
  }
}

async function initializeHomeAssistantAnalysis() {
  if (!haAnalysisState) return;
  try {
    const response = await fetch("api/home-assistant-token-status");
    const status = await response.json();
    if (!status.connected) {
      renderHaAnalysis({
        ok: false,
        error: t("error.ha_not_connected"),
        needs_connection: true,
        default_url: status.default_url,
        analysis: null,
      });
      return;
    }
    await loadHomeAssistantAnalysis();
  } catch (error) {
    renderHaAnalysis({
      ok: false,
      error: t("error.ha_unreachable"),
      needs_connection: true,
      default_url: "http://homeassistant.local:8123",
      analysis: null,
    });
  }
}

function resetDependentAnswers(fromStep) {
  if (fromStep <= 0) {
    state.manufacturer = "";
    state.model = "";
    state.connection = "";
    state.infrastructureAnswers = {};
    state.selectedKnowledgeDevice = null;
    state.selectedKnowledgeDetails = null;
    resetPairingState();
    knowledgeWizard.modelFilter = "";
  }
  if (fromStep <= 1) {
    state.model = "";
    state.connection = "";
    state.infrastructureAnswers = {};
    state.selectedKnowledgeDevice = null;
    state.selectedKnowledgeDetails = null;
    resetPairingState();
    knowledgeWizard.modelFilter = "";
  }
  if (fromStep <= 2) {
    state.connection = "";
    state.infrastructureAnswers = {};
    state.selectedKnowledgeDevice = null;
    state.selectedKnowledgeDetails = null;
    resetPairingState();
  }
  if (fromStep <= 3) {
    state.infrastructureAnswers = {};
  }
}

function resetPairingState() {
  state.pairing = {
    ready: false,
    phase: "idle",
    message: "",
    homeAssistantUrl: "",
  };
}

function setCategory(id) {
  if (!hasStarted) return;
  state.category = id;
  resetDependentAnswers(0);
  currentStep = 0;
  render();
}

function renderOptions(options, selected, onSelect) {
  const grid = document.createElement("div");
  grid.className = "option-grid";
  options.forEach((option) => {
    const id = typeof option === "string" ? option : option.id;
    const title = typeof option === "string" ? option : option.title;
    const icon = typeof option === "string" ? null : option.icon;
    const button = document.createElement("button");
    button.className = id === selected ? "option-card active" : "option-card";
    button.type = "button";
    button.innerHTML = `${icon ? `<span>${icons[icon] || ""}</span>` : ""}<strong>${title}</strong>`;
    button.addEventListener("click", () => {
      onSelect(id);
      render();
    });
    grid.appendChild(button);
  });
  return grid;
}

function renderSelect(label, options, value, onChange) {
  const wrap = document.createElement("label");
  wrap.className = "field";
  wrap.innerHTML = `<span>${label}</span>`;
  const select = document.createElement("select");
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = t("common.please_select");
  select.appendChild(placeholder);
  options.forEach((option) => {
    const item = document.createElement("option");
    item.value = option;
    item.textContent = option;
    select.appendChild(item);
  });
  select.value = value;
  select.addEventListener("change", () => {
    onChange(select.value);
    render();
  });
  wrap.appendChild(select);
  return wrap;
}

function protocolToConnection(protocol) {
  const normalized = String(protocol || "").toLowerCase();
  if (normalized === "wifi" || normalized === "wlan") return "wifi";
  return tree.connections.some((connection) => connection.id === normalized) ? normalized : "";
}

function connectionLabel(id) {
  return tree.connections.find((connection) => connection.id === id)?.title || id;
}

function capabilityLabel(capability) {
  const value = capability?.value || {};
  if (typeof value === "string") return capability.capability || value;
  return value.name || value.property || capability.capability || value.type || t("device.capability");
}

function knowledgeCapabilities(details, limit = 5) {
  return (details?.capabilities || [])
    .map((capability) => capabilityLabel(capability).replace(/^expose:/, ""))
    .filter(Boolean)
    .slice(0, limit);
}

function knowledgeDeviceLabel(device) {
  if (!device) return "";
  const vendor = device.vendor || device.canonical_vendor || t("device.unknown_vendor");
  const model = device.model || device.canonical_model || t("device.unknown_model");
  return `${vendor} ${model}`;
}

function supportedPlatforms(details) {
  return (details?.compatibility || [])
    .filter((item) => item.supported)
    .map((item) => item.platform)
    .filter(Boolean);
}

function renderKnowledgeContext() {
  const device = state.selectedKnowledgeDevice;
  if (!device) return "";
  const details = state.selectedKnowledgeDetails;
  const capabilities = knowledgeCapabilities(details, 4);
  const platforms = supportedPlatforms(details);
  return `
    <span class="guide-context">
      <strong>${t("knowledge.context")}</strong>
      <span>${escapeHtml(device.vendor || device.canonical_vendor)} ${escapeHtml(device.model || device.canonical_model)}</span>
      <small>${t("knowledge.protocol", { protocol: escapeHtml(device.protocol || t("common.unknown_lower")) })}</small>
      ${capabilities.length ? `<small>${t("knowledge.capabilities", { list: capabilities.map(escapeHtml).join(", ") })}</small>` : ""}
      ${platforms.length ? `<small>${t("knowledge.compatible_with", { list: platforms.map(escapeHtml).join(", ") })}</small>` : ""}
    </span>
  `;
}

async function loadKnowledgeVendors() {
  if (knowledgeWizard.vendors) return;
  try {
    const response = await fetch("vendors");
    if (!response.ok) throw new Error(t("error.api_unreachable"));
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || t("error.api_unreachable"));
    knowledgeWizard.vendors = (result.items || []).map((item) => item.vendor).filter(Boolean);
    knowledgeWizard.vendorsError = "";
  } catch (error) {
    knowledgeWizard.vendors = null;
    knowledgeWizard.vendorsError = t("knowledge.vendors_error");
  }
  render();
}

async function loadKnowledgeDevicesForVendor(vendor) {
  if (!vendor || knowledgeWizard.devicesByVendor[vendor] || knowledgeWizard.devicesErrorByVendor[vendor]) return;
  try {
    const response = await fetch(`devices/by-vendor?vendor=${encodeURIComponent(vendor)}`);
    if (!response.ok) throw new Error(t("error.api_unreachable"));
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || t("error.api_unreachable"));
    knowledgeWizard.devicesByVendor[vendor] = result.items || [];
    knowledgeWizard.devicesErrorByVendor[vendor] = "";
  } catch (error) {
    knowledgeWizard.devicesByVendor[vendor] = null;
    knowledgeWizard.devicesErrorByVendor[vendor] = t("knowledge.devices_error");
  }
  render();
}

async function selectKnowledgeDevice(device) {
  state.model = device.model;
  state.selectedKnowledgeDevice = device;
  state.connection = protocolToConnection(device.protocol) || state.connection;
  state.infrastructureAnswers = {};
  resetPairingState();
  try {
    const response = await fetch(`devices/${encodeURIComponent(device.device_id)}`);
    if (response.ok) {
      const result = await response.json();
      if (result.ok) {
        state.selectedKnowledgeDetails = result;
      }
    }
  } catch (error) {
    state.selectedKnowledgeDetails = null;
  }
  render();
}

function renderManufacturerStep() {
  const wrap = document.createElement("div");
  wrap.className = "wizard-stack";
  const vendors = knowledgeWizard.vendors || [];
  if (knowledgeWizard.vendorsError) {
    const notice = document.createElement("p");
    notice.className = "inline-warning";
    notice.textContent = knowledgeWizard.vendorsError;
    wrap.appendChild(notice);
  }
  wrap.appendChild(
    renderSelect(t("profile.manufacturer"), vendors, state.manufacturer, (value) => {
      state.manufacturer = value;
      resetDependentAnswers(1);
      loadKnowledgeDevicesForVendor(value);
    })
  );
  return wrap;
}

function renderKnowledgeModels(devices) {
  const filtered = devices.filter((device) => {
    const needle = knowledgeWizard.modelFilter.trim().toLowerCase();
    if (!needle) return true;
    return [device.model, device.display_name, device.device_type, device.protocol]
      .some((value) => String(value || "").toLowerCase().includes(needle));
  });
  const wrap = document.createElement("div");
  wrap.className = "model-picker";
  wrap.innerHTML = `
    <label class="field model-filter">
      <span>${t("wizard.model_search")}</span>
      <input id="modelFilterInput" type="search" value="${escapeHtml(knowledgeWizard.modelFilter)}" placeholder="${t("search.placeholder")}" />
    </label>
  `;
  const filterInput = wrap.querySelector("#modelFilterInput");
  filterInput.addEventListener("input", () => {
    knowledgeWizard.modelFilter = filterInput.value;
    render();
  });

  const grid = document.createElement("div");
  grid.className = "model-grid";
  filtered.slice(0, 80).forEach((device) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.deviceId = device.device_id;
    button.className = state.selectedKnowledgeDevice?.device_id === device.device_id ? "model-card active" : "model-card";
    button.innerHTML = `
      <strong>${escapeHtml(device.vendor)} ${escapeHtml(device.model)}</strong>
      <small>${escapeHtml(device.display_name || t("device.no_display_name"))}</small>
      <em>${escapeHtml(device.protocol || t("common.unknown_lower"))}${device.device_type ? ` · ${escapeHtml(device.device_type)}` : ""}</em>
    `;
    button.addEventListener("click", () => selectKnowledgeDevice(device));
    grid.appendChild(button);
  });
  if (!filtered.length) {
    grid.innerHTML = `<p class="empty-state">${t("wizard.no_devices_for_vendor")}</p>`;
  }
  wrap.appendChild(grid);
  if (filtered.length > 80) {
    const hint = document.createElement("p");
    hint.className = "inline-hint";
    hint.textContent = t("wizard.too_many_devices", { count: filtered.length });
    wrap.appendChild(hint);
  }
  return wrap;
}

function renderModelStep() {
  const wrap = document.createElement("div");
  wrap.className = "wizard-stack";
  if (!state.manufacturer) {
    wrap.innerHTML = `<p class="empty-state">${t("wizard.choose_vendor_first")}</p>`;
    return wrap;
  }

  const devices = knowledgeWizard.devicesByVendor[state.manufacturer];
  const error = knowledgeWizard.devicesErrorByVendor[state.manufacturer];
  if (error) {
    const notice = document.createElement("p");
    notice.className = "inline-warning";
    notice.textContent = error;
    wrap.appendChild(notice);
    return wrap;
  }

  if (!devices) {
    wrap.innerHTML = `<div class="detail-loading"><span class="analysis-spinner"></span><strong>${t("wizard.loading_devices")}</strong></div>`;
    loadKnowledgeDevicesForVendor(state.manufacturer);
    return wrap;
  }

  if (!devices.length) {
    wrap.innerHTML = `<p class="empty-state">${t("wizard.no_devices_for_vendor")}</p>`;
    return wrap;
  }

  wrap.appendChild(renderKnowledgeModels(devices));
  return wrap;
}

function infrastructureItems() {
  return state.connection ? tree.infrastructure[state.connection] || [] : [];
}

function capabilityStatus(item) {
  const liveStatus = state.liveCapabilities?.[item.capability];
  if (liveStatus && liveStatus !== "unknown") return liveStatus;
  const status = tree.home_assistant_status?.capabilities?.[item.capability] || "unknown";
  if (status !== "unknown") return status;
  if (Object.prototype.hasOwnProperty.call(state.infrastructureAnswers, item.id)) {
    return state.infrastructureAnswers[item.id] ? "detected" : "missing";
  }
  return "unknown";
}

function statusText(status) {
  if (status === "detected") return t("status.detected");
  if (status === "missing") return t("status.missing");
  return t("status.unknown");
}

function statusIcon(status) {
  if (status === "detected") return icons.check;
  if (status === "missing") return icons.alert;
  return icons.clock;
}

function statusClass(status) {
  return status === "detected" ? "detected" : status === "missing" ? "missing" : "unknown";
}

function evaluatePath() {
  const analysis = compatibilityCheck();
  if (analysis) return analysis;

  const checks = infrastructureItems().map((item) => ({ ...item, status: capabilityStatus(item) }));
  const missing = checks.filter((item) => item.status === "missing");
  const unknown = checks.filter((item) => item.status === "unknown");

  if (missing.length > 0) {
    const hardwareMissing = missing.find((item) =>
      ["zigbee_coordinator", "thread_router", "bluetooth_adapter"].includes(item.id)
    );
    return {
      status: "missing",
      title: hardwareMissing ? t("result.hardware_required") : t("result.requirements_missing"),
      reason: tn("result.n_missing", missing.length),
      action: missing[0].action,
      items: checks,
    };
  }

  if (unknown.length > 0) {
    return {
      status: "unknown",
      title: t("result.not_yet_certain"),
      reason: t("result.not_yet_certain_reason"),
      action: t("result.not_yet_certain_action"),
      items: checks,
    };
  }

  return {
    status: "ready",
    title: t("result.path_possible"),
    reason: tree.recommendations[state.connection] || t("result.path_possible_reason"),
    action: t("result.path_possible_action"),
    items: checks,
  };
}

function compatibilityCheck() {
  if (state.selectedKnowledgeDevice) {
    const device = state.selectedKnowledgeDevice;
    const details = state.selectedKnowledgeDetails;
    const platforms = supportedPlatforms(details);
    const capabilities = knowledgeCapabilities(details, 6);
    const checks = [
      {
        label: t("check.catalog"),
        state: "present",
        detail: t("check.device_found"),
      },
      {
        label: t("check.protocol"),
        state: device.protocol ? "present" : "unknown",
        detail: device.protocol || t("common.unknown_lower"),
      },
      {
        label: t("check.compatibility"),
        state: platforms.length ? "present" : "unknown",
        detail: platforms.length ? platforms.join(", ") : t("check.no_platform_rating"),
      },
    ];
    return {
      status: "ready",
      title: t("result.found_in_catalog"),
      reason: t("result.found_in_catalog_reason", {
        device: knowledgeDeviceLabel(device),
        protocol: device.protocol || t("result.device_generic"),
      }),
      action: platforms.length
        ? t("result.recommended_path", { platform: platforms[0] })
        : t("result.use_protocol_path"),
      checks,
      integrations: platforms.length ? platforms : ["Zigbee2MQTT"],
      capabilitySummary: capabilities,
      actionFlow: String(device.protocol || "").toLowerCase() === "zigbee" ? "zigbee_pairing" : null,
    };
  }

  return null;
}

function shouldShowZigbeePairing(evaluation) {
  return evaluation.actionFlow === "zigbee_pairing" && state.selectedKnowledgeDevice;
}

function pairingInstructionText() {
  const model = String(state.model || "").toLowerCase();
  if (model.includes("ts011f")) {
    return t("pairing.instruction_ts011f");
  }
  return t("pairing.instruction_generic");
}

function renderPairingFlow(evaluation) {
  const wrap = document.createElement("section");
  wrap.className = `pairing-flow ${state.pairing.phase}`;
  const haUrl =
    state.pairing.homeAssistantUrl ||
    (appConfig.managed_connection ? "/config/devices/dashboard" : "http://homeassistant.local:8123/config/devices/dashboard");
  wrap.innerHTML = `
    <div class="pairing-head">
      <span>${icons.radio}</span>
      <div>
        <h3>${t("pairing.title")}</h3>
        <p>${t("pairing.subtitle")}</p>
      </div>
    </div>
    <ol class="pairing-steps">
      <li class="${state.pairing.ready ? "done" : "active"}">
        <strong>${t("pairing.step1_title")}</strong>
        <span>${t("pairing.step1_body")} ${pairingInstructionText()}</span>
      </li>
      <li class="${state.pairing.phase === "searching" ? "active" : state.pairing.phase === "found" ? "done" : ""}">
        <strong>${t("pairing.step2_title")}</strong>
        <span>${t("pairing.step2_body")}</span>
      </li>
      <li class="${state.pairing.phase === "found" ? "done" : state.pairing.phase === "not_found" ? "active" : ""}">
        <strong>${t("pairing.step3_title")}</strong>
        <span>${t("pairing.step3_body")}</span>
      </li>
    </ol>
    <div class="pairing-actions">
      <button class="secondary" type="button" id="pairingReadyBtn" ${state.pairing.ready ? "disabled" : ""}>${t("pairing.ready_button")}</button>
      <button class="primary" type="button" id="startPairingBtn" ${state.pairing.ready && state.pairing.phase !== "searching" ? "" : "disabled"}>${t("pairing.start_button")}</button>
    </div>
    ${renderPairingState(haUrl)}
  `;
  wrap.querySelector("#pairingReadyBtn")?.addEventListener("click", () => {
    state.pairing.ready = true;
    state.pairing.phase = "ready";
    state.pairing.message = t("pairing.ready_message");
    render();
  });
  wrap.querySelector("#startPairingBtn")?.addEventListener("click", startZigbeePairing);
  return wrap;
}

function renderPairingState(haUrl) {
  if (state.pairing.phase === "idle") return "";
  if (state.pairing.phase === "ready") {
    return `<div class="pairing-state ready">${icons.check}<span>${escapeHtml(state.pairing.message)}</span></div>`;
  }
  if (state.pairing.phase === "searching") {
    return `<div class="pairing-state searching"><span class="analysis-spinner"></span><span>${t("pairing.searching")}</span></div>`;
  }
  if (state.pairing.phase === "found") {
    return `
      <div class="pairing-state found">${icons.check}<span>${t("pairing.found")}</span></div>
      <a class="ha-link" href="${escapeHtml(haUrl)}" target="_blank" rel="noreferrer">${t("pairing.open_devices")}</a>
    `;
  }
  return `
    <div class="pairing-state not-found">${icons.alert}<span>${escapeHtml(state.pairing.message || t("pairing.not_found"))}</span></div>
    <ul class="pairing-hints">
      <li>${t("pairing.hint_closer")}</li>
      <li>${t("pairing.hint_retry")}</li>
      <li>${t("pairing.hint_power")}</li>
      <li>${t("pairing.hint_logs")}</li>
    </ul>
    <a class="ha-link" href="${escapeHtml(haUrl)}" target="_blank" rel="noreferrer">${t("pairing.open_devices")}</a>
  `;
}

async function startZigbeePairing() {
  state.pairing.phase = "searching";
  state.pairing.message = "";
  render();
  try {
    const response = await fetch("api/home-assistant/zigbee/permit-join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duration: 120 }),
    });
    const result = await response.json();
    state.pairing.homeAssistantUrl = result.home_assistant_url || state.pairing.homeAssistantUrl;
    if (!result.ok) {
      state.pairing.phase = "not_found";
      state.pairing.message = result.message || result.error || t("pairing.not_connected_fallback");
      render();
      return;
    }

    const recentResponse = await fetch("api/home-assistant/devices/recent");
    const recent = await recentResponse.json();
    state.pairing.homeAssistantUrl = recent.home_assistant_url || state.pairing.homeAssistantUrl;
    if (recent.ok && recent.items?.length) {
      state.pairing.phase = "found";
      state.pairing.message = t("pairing.found");
    } else {
      state.pairing.phase = "not_found";
      state.pairing.message = recent.message || t("pairing.not_found");
    }
  } catch (error) {
    state.pairing.phase = "not_found";
    state.pairing.message = t("error.ha_unreachable");
  }
  render();
}

function renderInfrastructure() {
  const items = infrastructureItems();
  const wrap = document.createElement("div");
  wrap.className = "infra-list";
  if (!state.connection) {
    wrap.innerHTML = `<p class="empty-state">${t("wizard.choose_connection_first")}</p>`;
    return wrap;
  }

  const source = document.createElement("div");
  source.className = "probe-source";
  source.innerHTML = `<strong>${t("wizard.auto_check")}</strong><span>${state.liveCapabilities ? t("status.source_live") : tree.home_assistant_status?.source || t("wizard.ha_status_unknown")}</span>`;
  wrap.appendChild(source);

  items.forEach((item) => {
    const status = capabilityStatus(item);
    const row = document.createElement("div");
    row.className = `infra-item ${statusClass(status)}`;
    row.innerHTML = `
      <span class="infra-status">${statusIcon(status)}</span>
      <span class="infra-copy"><strong>${item.label}</strong><small>${statusText(status)}</small></span>
    `;
    wrap.appendChild(row);

    if (status === "unknown") {
      const question = document.createElement("div");
      question.className = "infra-question";
      question.innerHTML = `<p>${item.question}</p>`;
      [true, false].forEach((value) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = state.infrastructureAnswers[item.id] === value ? "mini-choice active" : "mini-choice";
        button.textContent = value ? t("common.yes") : t("common.no");
        button.addEventListener("click", () => {
          state.infrastructureAnswers[item.id] = value;
          render();
        });
        question.appendChild(button);
      });
      wrap.appendChild(question);
    }
  });
  return wrap;
}

function renderResult() {
  const evaluation = evaluatePath();
  const ready = evaluation.status === "ready";
  const result = document.createElement("div");
  result.className = "result-grid";

  const profile = [
    [t("profile.category"), currentCategory().title],
    [t("profile.manufacturer"), state.manufacturer],
    [t("profile.model"), state.model],
    [t("profile.connection"), state.connection && connectionLabel(state.connection)],
  ];
  if (state.selectedKnowledgeDevice) {
    profile.push([
      t("knowledge.context"),
      knowledgeDeviceLabel(state.selectedKnowledgeDevice),
    ]);
  }

  result.innerHTML = `
    <div class="result-card ${evaluation.status}">
      <span class="result-icon">${ready ? icons.check : evaluation.status === "unknown" ? icons.clock : icons.alert}</span>
      <h3>${evaluation.title}</h3>
      <p>${evaluation.reason}</p>
    </div>
    <div class="result-card muted-card">
      <span class="result-icon">${icons.route}</span>
      <h3>${t("profile.title")}</h3>
      <dl>${profile
        .map(([key, value]) => `<dt>${key}</dt><dd>${value || t("profile.open")}</dd>`)
        .join("")}</dl>
    </div>
  `;

  const next = document.createElement("div");
  next.className = "next-steps";
  next.innerHTML = `<h3>${ready ? t("result.next_steps") : t("result.recommendation")}</h3>`;
  const list = document.createElement("ul");
  const items = ready
    ? [
        evaluation.action,
        t("result.check_entities"),
      ]
    : [evaluation.action, ...(evaluation.items || []).filter((item) => item.status === "missing").map((item) => item.action)];
  items.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${ready ? icons.check : icons.alert}</span><span>${item}</span>`;
    list.appendChild(li);
  });
  next.appendChild(list);

  if (evaluation.integrations?.length) {
    const integrations = document.createElement("div");
    integrations.className = "integration-list";
    integrations.innerHTML = `<h3>${t("result.possible_integrations")}</h3><p>${evaluation.integrations.join(", ")}</p>`;
    result.appendChild(integrations);
  }

  const analysisChecks = evaluation.checks || evaluation.items || [];
  if (analysisChecks.length > 0) {
    const checks = document.createElement("div");
    checks.className = "check-summary analysis-summary";
    checks.innerHTML = `<h3>${t("result.analysis")}</h3>`;
    const checkList = document.createElement("ul");
    analysisChecks.forEach((item) => {
      const li = document.createElement("li");
      const stateName = item.state || item.status;
      li.className = stateName === "present" ? "detected" : stateName === "missing" ? "missing" : "unknown";
      li.innerHTML = `<span>${stateIcon(stateName)}</span><span>${item.label}<small>${item.detail || stateText(stateName)}</small></span>`;
      checkList.appendChild(li);
    });
    checks.appendChild(checkList);
    result.appendChild(checks);
  }

  if (shouldShowZigbeePairing(evaluation)) {
    result.appendChild(renderPairingFlow(evaluation));
  }

  result.appendChild(next);
  return result;
}

function stateIcon(stateName) {
  if (stateName === "present" || stateName === "detected") return icons.check;
  if (stateName === "missing") return icons.alert;
  return icons.clock;
}

function stateText(stateName) {
  if (stateName === "present" || stateName === "detected") return t("state.present");
  if (stateName === "missing") return t("state.missing");
  return t("state.unknown");
}

function canContinue() {
  const step = steps[currentStep].id;
  if (step === "category") return Boolean(state.category);
  if (step === "manufacturer") return Boolean(state.manufacturer);
  if (step === "model") return Boolean(state.model);
  if (step === "connection") return Boolean(state.connection);
  return true;
}

function renderQuestion() {
  const step = steps[currentStep].id;
  questionCard.replaceChildren();

  if (step === "category") {
    questionCard.appendChild(
      renderOptions(tree.categories, state.category, (id) => {
        state.category = id;
        resetDependentAnswers(0);
      })
    );
  }

  if (step === "manufacturer") {
    questionCard.appendChild(renderManufacturerStep());
  }

  if (step === "model") {
    questionCard.appendChild(renderModelStep());
  }

  if (step === "connection") {
    questionCard.appendChild(
      renderOptions(tree.connections, state.connection, (value) => {
        state.connection = value;
        resetDependentAnswers(3);
      })
    );
  }

  if (step === "infrastructure") {
    questionCard.appendChild(renderInfrastructure());
  }

  if (step === "result") {
    questionCard.appendChild(renderResult());
  }
}

function renderSummary() {
  const answers = [
    [t("profile.category"), currentCategory().title],
    [t("profile.manufacturer"), state.manufacturer || t("profile.open_short")],
    [t("profile.model"), state.model || t("profile.open_short")],
    [t("profile.connection"), state.connection ? connectionLabel(state.connection) : t("profile.open_short")],
  ];
  if (state.selectedKnowledgeDevice) {
    answers.push([
      t("knowledge.context"),
      knowledgeDeviceLabel(state.selectedKnowledgeDevice),
    ]);
  }
  answerList.replaceChildren(
    ...answers.flatMap(([label, value]) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      return [dt, dd];
    })
  );
}

function renderSteps() {
  stepList.replaceChildren(
    ...steps.map((step, index) => {
      const li = document.createElement("li");
      li.className = index === currentStep ? "active" : index < currentStep ? "done" : "";
      li.innerHTML = `<span>${index + 1}</span><strong>${step.title}</strong>`;
      li.addEventListener("click", () => {
        currentStep = index;
        render();
      });
      return li;
    })
  );
}

function render() {
  const category = currentCategory();
  const step = steps[currentStep];
  const percent = Math.round(((currentStep + 1) / steps.length) * 100);

  startPanel.classList.toggle("hidden", hasStarted);
  document.querySelector(".guide-panel").classList.toggle("hidden", !hasStarted);
  document.querySelector(".summary-panel").classList.toggle("hidden", !hasStarted);

  if (!hasStarted) {
    document.documentElement.style.setProperty("--guide-accent", "#03a9f4");
    return;
  }

  document.documentElement.style.setProperty("--guide-accent", category.accent);
  categoryIcon.innerHTML = icons[category.icon] || "";
  questionTitle.textContent = step.title;
  questionBody.innerHTML = `${escapeHtml(step.body)}${renderKnowledgeContext()}`;
  stepCounter.textContent = t("wizard.step_counter", { current: currentStep + 1, total: steps.length });
  progressLabel.textContent = `${percent}%`;
  progressBar.style.width = `${percent}%`;

  renderQuestion();
  renderSummary();
  renderSteps();

  prevBtn.disabled = currentStep === 0;
  nextBtn.disabled = !canContinue() || currentStep === steps.length - 1;
  nextBtn.innerHTML = `${t("wizard.next")} <span class="button-icon">${icons["arrow-right"]}</span>`;
}

manualStartBtn.addEventListener("click", () => {
  hasStarted = true;
  loadKnowledgeVendors();
  render();
});

prevBtn.addEventListener("click", () => {
  currentStep = Math.max(0, currentStep - 1);
  render();
});

nextBtn.addEventListener("click", () => {
  if (!canContinue()) return;
  currentStep = Math.min(steps.length - 1, currentStep + 1);
  render();
});

resetBtn.addEventListener("click", () => {
  state.category = tree.categories[0].id;
  resetDependentAnswers(0);
  currentStep = 0;
  hasStarted = false;
  render();
});

if (deviceSearchForm && deviceSearchInput) {
  deviceSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    searchKnowledgeDevices(deviceSearchInput.value);
  });
}

hydrateIcons();
render();
initializeHomeAssistantAnalysis();
loadKnowledgeVendors();
