const tree = JSON.parse(document.getElementById("treeData").textContent);

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

const steps = [
  {
    id: "category",
    title: "Was möchtest du einrichten?",
    body: "Wähle zuerst die Geräteart. Erst danach fragt Smart Guide nach Hersteller, Modell, Verbindung und Voraussetzungen.",
  },
  {
    id: "manufacturer",
    title: "Welcher Hersteller?",
    body: "Der Hersteller entscheidet oft, ob eine lokale Integration, eine Bridge oder eine Cloud-Anbindung nötig ist.",
  },
  {
    id: "model",
    title: "Welches Modell?",
    body: "Das Modell grenzt den passenden Integrationsweg ein. Wenn du es nicht genau kennst, wähle die nächstbeste Option.",
  },
  {
    id: "connection",
    title: "Welche Verbindung wird verwendet?",
    body: "Die Funk- oder Netzwerkart bestimmt, welche Infrastruktur vor konkreten Einrichtungsschritten vorhanden sein muss.",
  },
  {
    id: "infrastructure",
    title: "Automatische Prüfung der Voraussetzungen",
    body: "Smart Guide prüft zuerst, was aus Home Assistant ermittelt werden kann. Nur unklare Punkte werden noch abgefragt.",
  },
  {
    id: "result",
    title: "Bewertung und Integrationsweg",
    body: "Smart Guide zeigt, ob der Pfad möglich ist, welche Voraussetzungen fehlen und was als Nächstes zu tun ist.",
  },
];

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
        ${result.needs_connection ? renderConnectionFormMarkup(result.default_url) : ""}
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
          <strong>Home Assistant verbunden</strong>
          <small>Letzte Analyse: ${formatAnalysisTime(analysis.scanned_at)}</small>
        </div>
        <button class="secondary" type="button" id="changeConnectionBtn">Verbindung ändern</button>
      </div>
      <h3 class="recognition-title">Was Smart Guide erkannt hat</h3>
      <div class="simple-insights">
        ${renderCapabilitySection(translated.capabilities || [])}
        ${renderRealDeviceSection(translated.real_devices || {}, translated.integrations || {})}
        ${renderFoundationSection(translated.integrations || {})}
      </div>
      <div class="next-suggestion">
        <h3>Nächster sinnvoller Schritt</h3>
        <p>${buildTranslatedNextStep(translated)}</p>
        ${analysis.home_assistant_url ? `<a class="ha-link" href="${analysis.home_assistant_url}" target="_blank" rel="noreferrer">In Home Assistant öffnen</a>` : ""}
      </div>
      <details class="advanced-details">
        <summary>Technische Details anzeigen</summary>
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
  const items = capabilities.length ? capabilities : ["Noch keine nutzbaren Fähigkeiten erkannt"];
  return `
    <section class="insight-section">
      <h4>Bereits nutzbare Fähigkeiten</h4>
      ${items.map((item) => renderInsightLine(item, capabilities.length ? "ok" : "unknown")).join("")}
    </section>
  `;
}

function renderRealDeviceSection(realDevices, integrations) {
  const rows = [
    [`${realDevices.lights?.length || 0} Lichtgeräte`, realDevices.lights?.length > 0],
    [`${realDevices.tvs?.length || 0} Fernseher / Mediengeräte${integrations.android_tv ? " · Android TV erkannt" : ""}`, realDevices.tvs?.length > 0],
    [`${realDevices.echo_devices?.length || 0} Echo-Geräte`, realDevices.echo_devices?.length > 0],
    [`${realDevices.mobile_devices?.length || 0} Smartphone`, realDevices.mobile_devices?.length > 0],
  ];
  return `
    <section class="insight-section">
      <h4>Erkannte Geräte</h4>
      ${rows.map(([label, ok]) => renderInsightLine(label, ok ? "ok" : "unknown")).join("")}
    </section>
  `;
}

function renderFoundationSection(integrations) {
  return `
    <section class="insight-section">
      <h4>Technische Grundlagen</h4>
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
    ["Backup-System aktiv", tech.backup_sensors?.length || 0],
    ["Wetter / Sonne vorhanden", (tech.sun_sensors?.length || 0) + (tech.weather_sensors?.length || 0)],
    ["Systemsensoren", tech.system_sensors?.length || 0],
    ["Über Alexa sichtbare Geräte", tech.alexa_visible_devices?.length || 0],
    ["Klima / Umwelt", sensorGroups.climate_environment?.length || 0],
    ["Bewegung / Präsenz", sensorGroups.motion_presence?.length || 0],
    ["Energie", sensorGroups.energy?.length || 0],
    ["Smartphone-Sensoren", sensorGroups.smartphone?.length || 0],
    ["Sonstige Sensoren", sensorGroups.other?.length || 0],
  ];
  return `
    <section class="technical-block">
      <h4>Technische Systemfunktionen erkannt</h4>
      ${rows
        .filter(([, count]) => count > 0)
        .map(([label, count]) => renderInsightLine(`${label} (${count})`, "ok"))
        .join("") || renderInsightLine("Keine technischen Systemfunktionen erkannt", "unknown")}
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
    return "Die wichtigsten Gerätefähigkeiten wurden erkannt. Für neue Geräte sollte Smart Guide als Nächstes klären, ob Zigbee, MQTT, Matter oder Thread vorhanden ist.";
  }
  if ((translated.capabilities || []).length > 0) {
    return "Wähle jetzt aus, welches neue Gerät du hinzufügen möchtest. Smart Guide nutzt die erkannten Fähigkeiten als Kontext.";
  }
  return "Starte mit der manuellen Geräteauswahl. Smart Guide prüft danach, welcher Integrationsweg sinnvoll ist.";
}

function renderAnalysisGroup(key, group, homeAssistantUrl) {
  const examples = group.examples?.length
    ? group.examples.map((name) => `<li>${name}</li>`).join("")
    : "<li>Keine Geräte erkannt</li>";
  const entities = (group.entities || [])
    .map(
      (entity) => `
        <tr>
          <td>${entity.name}</td>
          <td><code>${entity.entity_id}</code></td>
          <td>${entity.status}</td>
          <td>${entity.area}</td>
        </tr>
      `
    )
    .join("");
  return `
    <section class="analysis-group" data-group="${key}">
      <div class="analysis-group-head">
        <h3>${group.label} (${group.count || 0})</h3>
        <button class="secondary details-toggle" type="button" data-target="${key}">Technische Details anzeigen</button>
      </div>
      <ul>${examples}</ul>
      <div class="analysis-details hidden" id="details-${key}">
        <table>
          <thead><tr><th>Name</th><th>Entity ID</th><th>Status</th><th>Bereich</th></tr></thead>
          <tbody>${entities || '<tr><td colspan="4">Keine Entitäten gefunden</td></tr>'}</tbody>
        </table>
        ${homeAssistantUrl ? `<a class="ha-link" href="${homeAssistantUrl}" target="_blank" rel="noreferrer">In Home Assistant öffnen</a>` : ""}
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
      const response = await fetch("/api/home-assistant-token-status");
      const status = await response.json();
      renderHaAnalysis({
        ok: false,
        error: "Home Assistant Verbindung ändern",
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
      button.textContent = panel.classList.contains("hidden") ? "Details anzeigen" : "Details ausblenden";
    });
  });
}

function renderCapabilityRow(label, detected) {
  return `<div class="analysis-row ${detected ? "ok" : "unknown"}"><span>${detected ? icons.check : icons.clock}</span><strong>${label} ${detected ? "erkannt" : "nicht erkannt"}</strong></div>`;
}

function renderUnknownRow(label, value) {
  return `<div class="analysis-row unknown"><span>${icons.clock}</span><strong>${label} ${translateAnalysisValue(value)}</strong></div>`;
}

function translateAnalysisValue(value) {
  if (value === "unknown") return "unbekannt";
  if (value === true) return "erkannt";
  if (value === false) return "nicht erkannt";
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
    setSearchStatus("Gib eine Modellnummer, einen Hersteller oder eine technische Kennung ein.", "muted");
    deviceSearchResults.innerHTML = "";
    deviceDetailPanel.classList.add("hidden");
    return;
  }

  setSearchStatus("Suche läuft...", "muted");
  deviceSearchResults.innerHTML = "";

  try {
    const response = await fetch(`/devices/search?q=${encodeURIComponent(trimmed)}`);
    if (!response.ok) throw new Error("API nicht erreichbar");
    const result = await response.json();
    if (!result.ok) {
      setSearchStatus(result.error || "API nicht erreichbar", "error");
      return;
    }
    renderSearchResults(result.items || []);
  } catch (error) {
    setSearchStatus("API nicht erreichbar", "error");
  }
}

function renderSearchResults(items) {
  if (!deviceSearchResults) return;
  if (!items.length) {
    setSearchStatus("Kein Gerät gefunden", "empty");
    deviceSearchResults.innerHTML = "";
    return;
  }

  setSearchStatus(`${items.length} Treffer gefunden`, "success");
  deviceSearchResults.innerHTML = items
    .map(
      (item) => `
        <button class="device-result" type="button" data-device-id="${item.device_id}">
          <span>
            <strong>${escapeHtml(item.vendor)} ${escapeHtml(item.model)}</strong>
            <small>${escapeHtml(item.display_name || "Ohne Anzeigename")}</small>
          </span>
          <span class="device-meta">
            <em>${escapeHtml(item.protocol || "unbekannt")}</em>
            <em>${escapeHtml(item.match_type || "Treffer")}</em>
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
  deviceDetailPanel.innerHTML = `<div class="detail-loading"><span class="analysis-spinner"></span><strong>Details werden geladen...</strong></div>`;

  try {
    const response = await fetch(`/devices/${encodeURIComponent(deviceId)}`);
    if (!response.ok) throw new Error("API nicht erreichbar");
    const result = await response.json();
    if (!result.ok) {
      deviceDetailPanel.innerHTML = `<div class="device-detail-error">${escapeHtml(result.error || "Gerät konnte nicht geladen werden")}</div>`;
      return;
    }
    state.selectedKnowledgeDevice = result.device;
    renderDeviceDetails(result);
    render();
  } catch (error) {
    deviceDetailPanel.innerHTML = `<div class="device-detail-error">API nicht erreichbar</div>`;
  }
}

function renderDeviceDetails(result) {
  const device = result.device || {};
  if (!deviceDetailPanel) return;
  deviceDetailPanel.innerHTML = `
    <div class="device-detail-head">
      <div>
        <p class="eyebrow">Ausgewähltes Gerät</p>
        <h3>${escapeHtml(device.display_name || `${device.canonical_vendor} ${device.canonical_model}`)}</h3>
        <p>${escapeHtml(device.description || "Keine Beschreibung vorhanden.")}</p>
      </div>
      <span>${escapeHtml(device.protocol || "unbekannt")}</span>
    </div>
    <div class="device-detail-grid">
      ${renderDetailList("Varianten", result.variants || [], (item) => [
        item.variant_name,
        item.model_number,
        item.region,
      ])}
      ${renderDetailList("Technische Identifier", result.identifiers || [], (item) => [
        item.identifier_type,
        item.identifier_value,
        item.source,
      ])}
      ${renderDetailList("Capabilities", result.capabilities || [], (item) => [
        item.capability,
        summarizeCapability(item.value),
        item.source,
      ])}
      ${renderDetailList("Kompatibilität", result.compatibility || [], (item) => [
        item.platform,
        item.supported ? "unterstützt" : "nicht unterstützt",
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
  const more = items.length > 12 ? `<p>${items.length - 12} weitere Einträge vorhanden.</p>` : "";
  return `
    <section class="detail-section">
      <h4>${escapeHtml(title)} (${items.length})</h4>
      <ul>${rows.join("") || "<li><span>Keine Daten vorhanden</span></li>"}</ul>
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
  if (!value) return "gerade eben";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return "gerade eben";
  if (minutes === 1) return "vor 1 Minute";
  return `vor ${minutes} Minuten`;
}

function renderConnectionFormMarkup(defaultUrl = "http://homeassistant.local:8123") {
  return `
    <form class="token-form" id="haConnectionForm">
      <h3>Home Assistant verbinden</h3>
      <label>
        <span>Home Assistant URL</span>
        <input id="haUrlInput" type="url" autocomplete="url" value="${defaultUrl || "http://homeassistant.local:8123"}" placeholder="http://homeassistant.local:8123" />
      </label>
      <label>
        <span>Long-Lived Access Token</span>
        <input id="haTokenInput" type="password" autocomplete="off" placeholder="Token einfügen" />
      </label>
      <button class="primary" type="submit">Verbindung testen</button>
      <small>Smart Guide bleibt auch ohne Verbindung bedienbar. Der Token wird nicht angezeigt.</small>
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
    haAnalysisState.innerHTML = `<span class="analysis-spinner"></span><strong>Analyse läuft...</strong>`;

    try {
      const response = await fetch("/api/home-assistant-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, token }),
      });
      const result = await response.json();
      if (!result.ok) {
        renderHaAnalysis({
          ok: false,
          error: result.error || "Home Assistant nicht verbunden",
          needs_connection: true,
          default_url: url,
          analysis: null,
        });
        return;
      }
      await loadHomeAssistantAnalysis();
    } catch (error) {
      renderHaAnalysis({ ok: false, error: "Home Assistant nicht erreichbar", needs_connection: true, default_url: url, analysis: null });
    }
  });
}

async function loadHomeAssistantAnalysis() {
  if (!haAnalysisState) return;
  haAnalysisState.className = "analysis-state";
  haAnalysisState.innerHTML = `<span class="analysis-spinner"></span><strong>Analyse läuft...</strong>`;
  try {
    const response = await fetch("/api/home-assistant-scan");
    renderHaAnalysis(await response.json());
  } catch (error) {
    renderHaAnalysis({ ok: false, error: "Home Assistant nicht erreichbar", needs_connection: false, analysis: null });
  }
}

async function initializeHomeAssistantAnalysis() {
  if (!haAnalysisState) return;
  try {
    const response = await fetch("/api/home-assistant-token-status");
    const status = await response.json();
    if (!status.connected) {
      renderHaAnalysis({
        ok: false,
        error: "Home Assistant nicht verbunden",
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
      error: "Home Assistant nicht erreichbar",
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
  placeholder.textContent = "Bitte auswählen";
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
  if (normalized === "zigbee") return "Zigbee";
  if (normalized === "matter") return "Matter";
  if (normalized === "bluetooth") return "Bluetooth";
  if (normalized === "wifi" || normalized === "wlan") return "WLAN";
  return "";
}

function capabilityLabel(capability) {
  const value = capability?.value || {};
  if (typeof value === "string") return capability.capability || value;
  return value.name || value.property || capability.capability || value.type || "Fähigkeit";
}

function knowledgeCapabilities(details, limit = 5) {
  return (details?.capabilities || [])
    .map((capability) => capabilityLabel(capability).replace(/^expose:/, ""))
    .filter(Boolean)
    .slice(0, limit);
}

function knowledgeDeviceLabel(device) {
  if (!device) return "";
  const vendor = device.vendor || device.canonical_vendor || "Unbekannter Hersteller";
  const model = device.model || device.canonical_model || "Unbekanntes Modell";
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
      <strong>Knowledge-Kontext</strong>
      <span>${escapeHtml(device.vendor || device.canonical_vendor)} ${escapeHtml(device.model || device.canonical_model)}</span>
      <small>Protokoll: ${escapeHtml(device.protocol || "unbekannt")}</small>
      ${capabilities.length ? `<small>Fähigkeiten: ${capabilities.map(escapeHtml).join(", ")}</small>` : ""}
      ${platforms.length ? `<small>Kompatibel mit: ${platforms.map(escapeHtml).join(", ")}</small>` : ""}
    </span>
  `;
}

async function loadKnowledgeVendors() {
  if (knowledgeWizard.vendors) return;
  try {
    const response = await fetch("/vendors");
    if (!response.ok) throw new Error("API nicht erreichbar");
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "API nicht erreichbar");
    knowledgeWizard.vendors = (result.items || []).map((item) => item.vendor).filter(Boolean);
    knowledgeWizard.vendorsError = "";
  } catch (error) {
    knowledgeWizard.vendors = null;
    knowledgeWizard.vendorsError = "Knowledge-API nicht erreichbar. Statische Hersteller werden verwendet.";
  }
  render();
}

async function loadKnowledgeDevicesForVendor(vendor) {
  if (!vendor || knowledgeWizard.devicesByVendor[vendor] || knowledgeWizard.devicesErrorByVendor[vendor]) return;
  try {
    const response = await fetch(`/devices/by-vendor?vendor=${encodeURIComponent(vendor)}`);
    if (!response.ok) throw new Error("API nicht erreichbar");
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "API nicht erreichbar");
    knowledgeWizard.devicesByVendor[vendor] = result.items || [];
    knowledgeWizard.devicesErrorByVendor[vendor] = "";
  } catch (error) {
    knowledgeWizard.devicesByVendor[vendor] = null;
    knowledgeWizard.devicesErrorByVendor[vendor] = "Knowledge-API nicht erreichbar. Statische Modellwerte werden verwendet.";
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
    const response = await fetch(`/devices/${encodeURIComponent(device.device_id)}`);
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
  const fallback = tree.manufacturers[state.category] || [];
  const vendors = knowledgeWizard.vendors || fallback;
  if (knowledgeWizard.vendorsError) {
    const notice = document.createElement("p");
    notice.className = "inline-warning";
    notice.textContent = knowledgeWizard.vendorsError;
    wrap.appendChild(notice);
  }
  wrap.appendChild(
    renderSelect("Hersteller", vendors, state.manufacturer, (value) => {
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
      <span>Modell suchen</span>
      <input id="modelFilterInput" type="search" value="${escapeHtml(knowledgeWizard.modelFilter)}" placeholder="z. B. TS011F" />
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
      <small>${escapeHtml(device.display_name || "Ohne Anzeigename")}</small>
      <em>${escapeHtml(device.protocol || "unbekannt")}${device.device_type ? ` · ${escapeHtml(device.device_type)}` : ""}</em>
    `;
    button.addEventListener("click", () => selectKnowledgeDevice(device));
    grid.appendChild(button);
  });
  if (!filtered.length) {
    grid.innerHTML = `<p class="empty-state">Keine Geräte für diesen Hersteller gefunden.</p>`;
  }
  wrap.appendChild(grid);
  if (filtered.length > 80) {
    const hint = document.createElement("p");
    hint.className = "inline-hint";
    hint.textContent = `${filtered.length} Geräte gefunden. Verfeinere die Suche, um die Liste einzugrenzen.`;
    wrap.appendChild(hint);
  }
  return wrap;
}

function renderModelStep() {
  const wrap = document.createElement("div");
  wrap.className = "wizard-stack";
  if (!state.manufacturer) {
    wrap.innerHTML = `<p class="empty-state">Wähle zuerst einen Hersteller.</p>`;
    return wrap;
  }

  const devices = knowledgeWizard.devicesByVendor[state.manufacturer];
  const error = knowledgeWizard.devicesErrorByVendor[state.manufacturer];
  if (error) {
    const notice = document.createElement("p");
    notice.className = "inline-warning";
    notice.textContent = error;
    wrap.appendChild(notice);
    wrap.appendChild(
      renderSelect("Modell", tree.models[state.manufacturer] || tree.models.Sonstiger, state.model, (value) => {
        state.model = value;
        resetDependentAnswers(2);
      })
    );
    return wrap;
  }

  if (!devices) {
    wrap.innerHTML = `<div class="detail-loading"><span class="analysis-spinner"></span><strong>Geräte werden geladen...</strong></div>`;
    loadKnowledgeDevicesForVendor(state.manufacturer);
    return wrap;
  }

  if (!devices.length) {
    wrap.innerHTML = `<p class="empty-state">Keine Geräte für diesen Hersteller gefunden.</p>`;
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
  if (status === "detected") return "Erkannt";
  if (status === "missing") return "Fehlt";
  return "Unklar";
}

function statusIcon(status) {
  if (status === "detected") return icons.check;
  if (status === "missing") return icons.alert;
  return icons.clock;
}

function statusClass(status) {
  return status === "detected" ? "detected" : status === "missing" ? "missing" : "unknown";
}

function unsupportedConnection() {
  const allowed = tree.compatibility?.[state.manufacturer];
  return Boolean(allowed && state.connection && !allowed.includes(state.connection));
}

function evaluatePath() {
  const analysis = compatibilityCheck();
  if (analysis) return analysis;

  if (unsupportedConnection()) {
    return {
      status: "blocked",
      title: "Verbindungstyp wird nicht unterstützt",
      reason: `${state.manufacturer} wird in Smart Guide aktuell nicht sinnvoll über ${state.connection} geführt.`,
      action: `Wähle einen unterstützten Verbindungstyp: ${(tree.compatibility[state.manufacturer] || []).join(", ")}.`,
      items: [],
    };
  }

  const checks = infrastructureItems().map((item) => ({ ...item, status: capabilityStatus(item) }));
  const missing = checks.filter((item) => item.status === "missing");
  const unknown = checks.filter((item) => item.status === "unknown");

  if (state.manufacturer === "Sonstiger" && state.model === "Modell unbekannt") {
    return {
      status: "blocked",
      title: "Integration existiert nicht oder ist unbekannt",
      reason: "Ohne Hersteller- oder Modellinformation kann Smart Guide keine passende Home Assistant Integration bestimmen.",
      action: "Ermittle Hersteller, Modellnummer oder Funkstandard am Gerät, auf der Verpackung oder in der Hersteller-App.",
      items: checks,
    };
  }

  if (missing.length > 0) {
    const hardwareMissing = missing.find((item) =>
      ["zigbee_coordinator", "thread_router", "bluetooth_adapter"].includes(item.id)
    );
    return {
      status: "missing",
      title: hardwareMissing ? "Zusätzliche Hardware erforderlich" : "Voraussetzungen fehlen",
      reason: `${missing.length} Voraussetzung${missing.length === 1 ? "" : "en"} fehlen für diesen Integrationsweg.`,
      action: missing[0].action,
      items: checks,
    };
  }

  if (unknown.length > 0) {
    return {
      status: "unknown",
      title: "Noch nicht sicher integrierbar",
      reason: "Einige Informationen konnten nicht automatisch aus Home Assistant ermittelt werden.",
      action: "Beantworte die offenen Rückfragen oder verbinde Smart Guide später direkt mit Home Assistant.",
      items: checks,
    };
  }

  return {
    status: "ready",
    title: "Integrationsweg möglich",
    reason: tree.recommendations[state.connection] || "Der gewählte Pfad ist grundsätzlich möglich.",
    action: "Öffne jetzt die passende Home Assistant Integration und starte erst danach die konkrete Geräteeinbindung.",
    items: checks,
  };
}

function normalizeAnalysisStatus(status) {
  if (status === "integratable") return "ready";
  if (status === "missing_requirements") return "missing";
  if (status === "not_compatible") return "blocked";
  return "unknown";
}

function findDeviceEntry() {
  const exact = (tree.device_database || []).find(
    (device) =>
      device.category === state.category &&
      device.manufacturer === state.manufacturer &&
      device.model === state.model &&
      device.connection === state.connection
  );
  if (exact) return { device: exact };

  const sameModel = (tree.device_database || []).find(
    (device) =>
      device.category === state.category &&
      device.manufacturer === state.manufacturer &&
      device.model === state.model
  );
  if (sameModel) return { device: sameModel, connectionMismatch: true };

  const sameManufacturer = (tree.device_database || []).find(
    (device) => device.category === state.category && device.manufacturer === state.manufacturer
  );
  if (sameManufacturer) return { device: sameManufacturer, unknownModel: true };

  return null;
}

function compatibilityCheck() {
  if (state.selectedKnowledgeDevice) {
    const device = state.selectedKnowledgeDevice;
    const details = state.selectedKnowledgeDetails;
    const platforms = supportedPlatforms(details);
    const capabilities = knowledgeCapabilities(details, 6);
    const checks = [
      {
        label: "Knowledge-Datenbank",
        state: "present",
        detail: "Gerät gefunden.",
      },
      {
        label: "Protokoll",
        state: device.protocol ? "present" : "unknown",
        detail: device.protocol || "unbekannt",
      },
      {
        label: "Kompatibilität",
        state: platforms.length ? "present" : "unknown",
        detail: platforms.length ? platforms.join(", ") : "Noch keine Plattformbewertung vorhanden.",
      },
    ];
    return {
      status: "ready",
      title: "Gerät in der Knowledge-Datenbank gefunden",
      reason: `${device.vendor || device.canonical_vendor} ${device.model || device.canonical_model} ist als ${device.protocol || "Gerät"} hinterlegt.`,
      action: platforms.length
        ? `Empfohlener Integrationsweg: ${platforms[0]}. SmartGuide führt dich jetzt durch den Such- und Kopplungsprozess.`
        : "Nutze das erkannte Protokoll als Integrationspfad. SmartGuide führt dich jetzt durch den Such- und Kopplungsprozess.",
      checks,
      integrations: platforms.length ? platforms : ["Zigbee2MQTT"],
      capabilitySummary: capabilities,
      actionFlow: String(device.protocol || "").toLowerCase() === "zigbee" ? "zigbee_pairing" : null,
    };
  }

  const match = findDeviceEntry();
  const haStatus = state.liveHaStatus || tree.ha_status || {};
  if (!match) {
    return {
      status: "unknown",
      title: "Gerät nicht in der Datenbank",
      reason: "Für diese Kombination aus Hersteller, Modell und Verbindung liegen noch keine belastbaren Daten vor.",
      action: "Hersteller, Modellnummer und Funkstandard prüfen oder das Gerät als neues Datenbankprofil ergänzen.",
      checks: [{ label: "Gerätedatenbank", state: "unknown", detail: "Kein passender Eintrag gefunden." }],
      integrations: [],
    };
  }

  if (match.connectionMismatch) {
    return {
      status: "blocked",
      title: "Verbindungstyp wird nicht unterstützt",
      reason: `${state.manufacturer} ${state.model} ist bekannt, aber nicht mit ${state.connection} hinterlegt.`,
      action: `Wähle einen bekannten Verbindungstyp für dieses Gerät, zum Beispiel ${match.device.connection}.`,
      checks: [
        { label: "Gerät bekannt", state: "present", detail: `${state.manufacturer} ${state.model}` },
        { label: "Verbindung", state: "missing", detail: `${state.connection} nicht unterstützt.` },
      ],
      integrations: match.device.possible_integrations,
    };
  }

  if (match.unknownModel) {
    return {
      status: "unknown",
      title: "Modell noch nicht eindeutig bekannt",
      reason: `${state.manufacturer} ist bekannt, aber dieses Modell ist noch nicht sicher bewertet.`,
      action: "Modellnummer prüfen und mit der Gerätedatenbank abgleichen.",
      checks: [
        { label: "Hersteller", state: "present", detail: state.manufacturer },
        { label: "Modell", state: "unknown", detail: state.model },
      ],
      integrations: match.device.possible_integrations,
    };
  }

  const device = match.device;
  if (device.compatibility_status === "unclear") {
    return {
      status: "unknown",
      title: "Kompatibilität unklar",
      reason: "Die Datenbank kennt das Gerät, bewertet die Integration aber noch nicht sicher.",
      action: "Offizielle Home-Assistant-Integration und Community-Berichte prüfen.",
      checks: [{ label: "Kompatibilität", state: "unknown", detail: "Noch nicht verifiziert." }],
      integrations: device.possible_integrations,
    };
  }

  if (device.compatibility_status === "not_supported") {
    return {
      status: "blocked",
      title: "Gerät aktuell nicht integrierbar",
      reason: "Die Gerätedatenbank markiert dieses Gerät aktuell als nicht kompatibel.",
      action: "Alternative Verbindung oder anderes Gerät wählen.",
      checks: [{ label: "Kompatibilität", state: "missing", detail: "Nicht kompatibel." }],
      integrations: device.possible_integrations,
    };
  }

  const checks = device.required_infrastructure.map((infra) => ({
    label: infrastructureLabel(infra),
    state: haStatus[infra] ? "present" : "missing",
    detail: haStatus[infra] ? "vorhanden" : "fehlt",
  }));

  if (checks.length === 0) {
    checks.push({
      label: "Zusätzliche Infrastruktur",
      state: "present",
      detail: "Keine zusätzliche Infrastruktur erforderlich.",
    });
  }

  const missing = checks.filter((check) => check.state === "missing");
  if (missing.length > 0) {
    return {
      status: "missing",
      title: "Voraussetzungen fehlen",
      reason: `Für diesen Integrationsweg fehlen: ${missing.map((check) => check.label).join(", ")}.`,
      action: `Richte zuerst ${missing[0].label} ein und starte die Analyse danach erneut.`,
      checks,
      integrations: device.possible_integrations,
    };
  }

  return {
    status: "ready",
    title: "Gerät integrierbar",
    reason: "Die benötigte Infrastruktur ist laut Analyse vorhanden.",
    action: `Nutze die Integration ${device.possible_integrations[0]} und starte danach die konkrete Geräteeinbindung.`,
    checks,
    integrations: device.possible_integrations,
  };
}

function shouldShowZigbeePairing(evaluation) {
  return evaluation.actionFlow === "zigbee_pairing" && state.selectedKnowledgeDevice;
}

function pairingInstructionText() {
  const model = String(state.model || "").toLowerCase();
  if (model.includes("ts011f")) {
    return "Bei vielen TS011F-Steckdosen die Taste etwa 5-10 Sekunden halten, bis die LED schnell blinkt.";
  }
  return "Meist Reset-Taste 5-10 Sekunden halten, bis die LED blinkt.";
}

function renderPairingFlow(evaluation) {
  const wrap = document.createElement("section");
  wrap.className = `pairing-flow ${state.pairing.phase}`;
  const haUrl = state.pairing.homeAssistantUrl || "http://homeassistant.local:8123/config/devices/dashboard";
  wrap.innerHTML = `
    <div class="pairing-head">
      <span>${icons.radio}</span>
      <div>
        <h3>Zigbee-Gerät verbinden</h3>
        <p>SmartGuide begleitet dich jetzt durch Pairing und Suche.</p>
      </div>
    </div>
    <ol class="pairing-steps">
      <li class="${state.pairing.ready ? "done" : "active"}">
        <strong>1. Gerät in Suchmodus versetzen</strong>
        <span>Setze das Gerät jetzt in den Pairing-Modus. ${pairingInstructionText()}</span>
      </li>
      <li class="${state.pairing.phase === "searching" ? "active" : state.pairing.phase === "found" ? "done" : ""}">
        <strong>2. Suche in Home Assistant starten</strong>
        <span>SmartGuide startet den vorbereiteten Suchmodus oder meldet klar, was noch fehlt.</span>
      </li>
      <li class="${state.pairing.phase === "found" ? "done" : state.pairing.phase === "not_found" ? "active" : ""}">
        <strong>3. Neues Gerät prüfen</strong>
        <span>Danach wird geprüft, ob Home Assistant ein neues Gerät meldet.</span>
      </li>
    </ol>
    <div class="pairing-actions">
      <button class="secondary" type="button" id="pairingReadyBtn" ${state.pairing.ready ? "disabled" : ""}>Gerät ist im Suchmodus</button>
      <button class="primary" type="button" id="startPairingBtn" ${state.pairing.ready && state.pairing.phase !== "searching" ? "" : "disabled"}>Suche in Home Assistant starten</button>
    </div>
    ${renderPairingState(haUrl)}
  `;
  wrap.querySelector("#pairingReadyBtn")?.addEventListener("click", () => {
    state.pairing.ready = true;
    state.pairing.phase = "ready";
    state.pairing.message = "Gut. Starte jetzt die Suche in Home Assistant.";
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
    return `<div class="pairing-state searching"><span class="analysis-spinner"></span><span>Suche läuft...</span></div>`;
  }
  if (state.pairing.phase === "found") {
    return `
      <div class="pairing-state found">${icons.check}<span>Gerät verbunden</span></div>
      <a class="ha-link" href="${escapeHtml(haUrl)}" target="_blank" rel="noreferrer">Home Assistant Geräteübersicht öffnen</a>
    `;
  }
  return `
    <div class="pairing-state not-found">${icons.alert}<span>${escapeHtml(state.pairing.message || "Noch nicht gefunden")}</span></div>
    <ul class="pairing-hints">
      <li>Gerät näher an den Coordinator bringen</li>
      <li>Pairing erneut starten</li>
      <li>Batterie oder Stromversorgung prüfen</li>
      <li>Zigbee2MQTT- oder ZHA-Logs prüfen</li>
    </ul>
    <a class="ha-link" href="${escapeHtml(haUrl)}" target="_blank" rel="noreferrer">Home Assistant Geräteübersicht öffnen</a>
  `;
}

async function startZigbeePairing() {
  state.pairing.phase = "searching";
  state.pairing.message = "";
  render();
  try {
    const response = await fetch("/api/home-assistant/zigbee/permit-join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duration: 120 }),
    });
    const result = await response.json();
    state.pairing.homeAssistantUrl = result.home_assistant_url || state.pairing.homeAssistantUrl;
    if (!result.ok) {
      state.pairing.phase = "not_found";
      state.pairing.message = result.message || result.error || "Automatischer Suchmodus ist vorbereitet, aber noch nicht verbunden.";
      render();
      return;
    }

    const recentResponse = await fetch("/api/home-assistant/devices/recent");
    const recent = await recentResponse.json();
    state.pairing.homeAssistantUrl = recent.home_assistant_url || state.pairing.homeAssistantUrl;
    if (recent.ok && recent.items?.length) {
      state.pairing.phase = "found";
      state.pairing.message = "Gerät verbunden";
    } else {
      state.pairing.phase = "not_found";
      state.pairing.message = recent.message || "Noch nicht gefunden";
    }
  } catch (error) {
    state.pairing.phase = "not_found";
    state.pairing.message = "Home Assistant nicht erreichbar";
  }
  render();
}

function infrastructureLabel(key) {
  const labels = {
    mqtt: "MQTT",
    zigbee2mqtt: "Zigbee2MQTT",
    zha: "ZHA",
    matter: "Matter",
    thread: "Thread",
    hue: "Hue Bridge",
  };
  return labels[key] || key;
}

function renderInfrastructure() {
  const items = infrastructureItems();
  const wrap = document.createElement("div");
  wrap.className = "infra-list";
  if (!state.connection) {
    wrap.innerHTML = `<p class="empty-state">Wähle zuerst die Verbindungsart.</p>`;
    return wrap;
  }

  const source = document.createElement("div");
  source.className = "probe-source";
  source.innerHTML = `<strong>Automatische Prüfung</strong><span>${tree.home_assistant_status?.source || "Home Assistant Status unbekannt"}</span>`;
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
      ["Ja", "Nein"].forEach((label) => {
        const value = label === "Ja";
        const button = document.createElement("button");
        button.type = "button";
        button.className = state.infrastructureAnswers[item.id] === value ? "mini-choice active" : "mini-choice";
        button.textContent = label;
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
    ["Geräteart", currentCategory().title],
    ["Hersteller", state.manufacturer],
    ["Modell", state.model],
    ["Verbindung", state.connection],
  ];
  if (state.selectedKnowledgeDevice) {
    profile.push([
      "Knowledge-Kontext",
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
      <h3>Entscheidungsprofil</h3>
      <dl>${profile
        .map(([key, value]) => `<dt>${key}</dt><dd>${value || "Noch offen"}</dd>`)
        .join("")}</dl>
    </div>
  `;

  const next = document.createElement("div");
  next.className = "next-steps";
  next.innerHTML = `<h3>${ready ? "Nächste sinnvolle Schritte" : "Handlungsempfehlung"}</h3>`;
  const list = document.createElement("ul");
  const items = ready
    ? [
        evaluation.action,
        "Entitäten prüfen und Raum, Name sowie Dashboard-Zuordnung festlegen",
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
    integrations.innerHTML = `<h3>Mögliche Integrationen</h3><p>${evaluation.integrations.join(", ")}</p>`;
    result.appendChild(integrations);
  }

  const analysisChecks = evaluation.checks || evaluation.items || [];
  if (analysisChecks.length > 0) {
    const checks = document.createElement("div");
    checks.className = "check-summary analysis-summary";
    checks.innerHTML = `<h3>Analyse</h3>`;
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
  if (stateName === "present" || stateName === "detected") return "vorhanden";
  if (stateName === "missing") return "fehlt";
  return "unklar";
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
    ["Geräteart", currentCategory().title],
    ["Hersteller", state.manufacturer || "Offen"],
    ["Modell", state.model || "Offen"],
    ["Verbindung", state.connection || "Offen"],
  ];
  if (state.selectedKnowledgeDevice) {
    answers.push([
      "Knowledge-Kontext",
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
  stepCounter.textContent = `Schritt ${currentStep + 1} von ${steps.length}`;
  progressLabel.textContent = `${percent}%`;
  progressBar.style.width = `${percent}%`;

  renderQuestion();
  renderSummary();
  renderSteps();

  prevBtn.disabled = currentStep === 0;
  nextBtn.disabled = !canContinue() || currentStep === steps.length - 1;
  nextBtn.innerHTML = `Weiter <span class="button-icon">${icons["arrow-right"]}</span>`;
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
