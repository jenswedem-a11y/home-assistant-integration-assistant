import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
import urllib.error
import urllib.request

from fastapi import FastAPI, Request
from pydantic import BaseModel
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.search import router as search_router

APP_VERSION = "0.8.0"

app = FastAPI(title="Smart Guide", version=APP_VERSION)
app.include_router(search_router)

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

CONFIG_PATH = Path(os.environ.get("SMART_GUIDE_CONFIG_PATH", "/app/data/ha_config.json"))
RUNTIME_HOME_ASSISTANT_URL = None
RUNTIME_HOME_ASSISTANT_TOKEN = None
LAST_ANALYSIS_AT = None
LAST_ZIGBEE_PAIRING_STARTED_AT = None
PAIRING_KNOWN_ENTITY_IDS = None


class HomeAssistantTokenRequest(BaseModel):
    url: str = ""
    token: str


class ZigbeePermitJoinRequest(BaseModel):
    duration: int = 120


def load_saved_home_assistant_config():
    global RUNTIME_HOME_ASSISTANT_URL
    global RUNTIME_HOME_ASSISTANT_TOKEN
    env_url = os.environ.get("HOME_ASSISTANT_URL")
    env_token = os.environ.get("HOME_ASSISTANT_TOKEN")
    if env_url:
        RUNTIME_HOME_ASSISTANT_URL = env_url
    if env_token:
        RUNTIME_HOME_ASSISTANT_TOKEN = env_token
    if env_url and env_token:
        return
    try:
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return
    RUNTIME_HOME_ASSISTANT_URL = RUNTIME_HOME_ASSISTANT_URL or data.get("url")
    RUNTIME_HOME_ASSISTANT_TOKEN = RUNTIME_HOME_ASSISTANT_TOKEN or data.get("token")


def save_home_assistant_config(url, token):
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps({"url": url, "token": token}, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        CONFIG_PATH.chmod(0o600)
    except OSError:
        pass


load_saved_home_assistant_config()


DEFAULT_HA_STATUS = {
    "mqtt": False,
    "zigbee2mqtt": False,
    "zha": False,
    "matter": False,
    "thread": False,
    "hue": False,
}


DEVICE_DATABASE = [
    {
        "manufacturer": "Philips Hue",
        "model": "Hue White",
        "category": "licht",
        "connection": "Hersteller-Bridge",
        "required_infrastructure": ["hue"],
        "possible_integrations": ["Philips Hue"],
        "compatibility_status": "supported",
    },
    {
        "manufacturer": "Philips Hue",
        "model": "Hue White",
        "category": "licht",
        "connection": "Zigbee",
        "required_infrastructure": ["zha"],
        "possible_integrations": ["ZHA", "Zigbee2MQTT"],
        "compatibility_status": "supported",
    },
    {
        "manufacturer": "Aqara",
        "model": "Temperatur/Luftfeuchte",
        "category": "sensor",
        "connection": "Zigbee",
        "required_infrastructure": ["zha"],
        "possible_integrations": ["ZHA", "Zigbee2MQTT"],
        "compatibility_status": "supported",
    },
    {
        "manufacturer": "Aqara",
        "model": "Thermostat E1",
        "category": "heizung",
        "connection": "Zigbee",
        "required_infrastructure": ["zigbee2mqtt", "mqtt"],
        "possible_integrations": ["Zigbee2MQTT"],
        "compatibility_status": "supported",
    },
    {
        "manufacturer": "IKEA Tradfri",
        "model": "Tradfri Steckdose",
        "category": "steckdose",
        "connection": "Zigbee",
        "required_infrastructure": ["zha"],
        "possible_integrations": ["ZHA", "Zigbee2MQTT"],
        "compatibility_status": "supported",
    },
    {
        "manufacturer": "Shelly",
        "model": "Shelly Plug S",
        "category": "steckdose",
        "connection": "WLAN",
        "required_infrastructure": [],
        "possible_integrations": ["Shelly"],
        "compatibility_status": "supported",
    },
    {
        "manufacturer": "Samsung",
        "model": "Tizen TV",
        "category": "fernseher",
        "connection": "WLAN",
        "required_infrastructure": [],
        "possible_integrations": ["Samsung Smart TV"],
        "compatibility_status": "supported",
    },
    {
        "manufacturer": "Tuya",
        "model": "Matter Gerät",
        "category": "sensor",
        "connection": "Matter",
        "required_infrastructure": ["matter"],
        "possible_integrations": ["Matter"],
        "compatibility_status": "supported",
    },
    {
        "manufacturer": "Tuya",
        "model": "Bluetooth Gerät",
        "category": "sensor",
        "connection": "Bluetooth",
        "required_infrastructure": [],
        "possible_integrations": [],
        "compatibility_status": "unclear",
    },
    {
        "manufacturer": "Homematic IP",
        "model": "Heizkörperthermostat",
        "category": "heizung",
        "connection": "Hersteller-Bridge",
        "required_infrastructure": [],
        "possible_integrations": ["HomematicIP Cloud", "Homematic"],
        "compatibility_status": "supported",
    },
]


INFRA_LABELS = {
    "mqtt": "MQTT",
    "zigbee2mqtt": "Zigbee2MQTT",
    "zha": "ZHA",
    "matter": "Matter",
    "thread": "Thread",
    "hue": "Hue Bridge",
}


def has_any_term(value, terms):
    text = str(value or "").lower()
    return any(term in text for term in terms)


def detect_infrastructure(states, services):
    domains = {entry.get("domain") for entry in services if isinstance(entry, dict)}
    zigbee2mqtt = any(
        has_any_term(entity.get("entity_id"), ["zigbee2mqtt"])
        or has_any_term((entity.get("attributes") or {}).get("friendly_name"), ["zigbee2mqtt"])
        for entity in states
    )
    return {
        "mqtt": "mqtt" in domains,
        "zigbee2mqtt": zigbee2mqtt,
        "zha": "zha" in domains,
        "matter": "matter" in domains,
        "thread": "thread" in domains,
        "hue": "hue" in domains,
    }


def build_capability_map(ha_status, connected):
    fallback = "missing" if connected else "unknown"
    return {
        "integrations": "unknown",
        "network_devices": "unknown",
        "mqtt": "detected" if ha_status["mqtt"] else fallback,
        "zigbee_stack": "detected" if (ha_status["zigbee2mqtt"] or ha_status["zha"]) else fallback,
        "zigbee_coordinator": "detected" if (ha_status["zigbee2mqtt"] or ha_status["zha"]) else fallback,
        "matter": "detected" if ha_status["matter"] else fallback,
        "thread": "detected" if ha_status["thread"] else fallback,
        "bluetooth": "unknown",
        "bluetooth_range": "unknown",
        "bluetooth_integration": "unknown",
        "bridge": "detected" if ha_status["hue"] else fallback,
        "bridge_devices": "unknown",
        "cloud_dependency": "unknown",
        "local_api": "unknown",
        "firewall": "unknown",
    }


def scan_home_assistant_states(states, infrastructure=None):
    global LAST_ANALYSIS_AT
    summary = {
        "lights": 0,
        "switches": 0,
        "sensors": 0,
        "binary_sensors": 0,
        "media_players": 0,
        "remotes": 0,
        "automations": 0,
        "mobile_devices": 0,
        "unavailable_count": 0,
        "alexa_detected": False,
        "android_tv_detected": False,
        "mqtt": "unknown",
        "zigbee": "unknown",
        "matter": "unknown",
        "thread": "unknown",
        "groups": {
            "lights": {"label": "Lichter", "entities": []},
            "televisions": {"label": "Fernseher", "entities": []},
            "sensors": {"label": "Sensoren", "entities": []},
            "voice_assistants": {"label": "Sprachassistenten", "entities": []},
            "mobile_devices": {"label": "Mobilgeräte", "entities": []},
        },
    }

    domain_map = {
        "light": "lights",
        "switch": "switches",
        "sensor": "sensors",
        "binary_sensor": "binary_sensors",
        "media_player": "media_players",
        "remote": "remotes",
        "automation": "automations",
        "device_tracker": "mobile_devices",
    }

    alexa_terms = ["echo", "alexa", "amazon"]
    android_tv_terms = ["android tv", "mitv", "mi tv", "google tv"]

    translator = {
        "capabilities": [],
        "real_devices": {
            "lights": [],
            "tvs": [],
            "echo_devices": [],
            "mobile_devices": [],
        },
        "sensor_groups": {
            "climate_environment": [],
            "motion_presence": [],
            "energy": [],
            "smartphone": [],
            "system": [],
            "other": [],
        },
        "technical_entities": {
            "system_sensors": [],
            "backup_sensors": [],
            "sun_sensors": [],
            "weather_sensors": [],
        },
        "integrations": {
            "android_tv": False,
            "alexa": False,
            "mqtt": infrastructure["mqtt"] if infrastructure else "unknown",
            "zigbee": (infrastructure["zigbee2mqtt"] or infrastructure["zha"]) if infrastructure else "unknown",
            "matter": infrastructure["matter"] if infrastructure else "unknown",
            "thread": infrastructure["thread"] if infrastructure else "unknown",
        },
    }
    media_by_name = {}
    echo_by_name = {}
    alexa_visible_by_name = {}

    for entity in states:
        entity_id = entity.get("entity_id", "")
        domain = entity_id.split(".", 1)[0]
        key = domain_map.get(domain)
        if key:
            summary[key] += 1

        if entity.get("state") == "unavailable":
            summary["unavailable_count"] += 1

        attributes = entity.get("attributes") or {}
        friendly_name = attributes.get("friendly_name", "")
        entry = {
            "name": friendly_name or entity_id,
            "entity_id": entity_id,
            "status": entity.get("state", "unknown"),
            "area": attributes.get("area_name") or attributes.get("area_id") or "Unbekannt",
        }

        lower_id = entity_id.lower()
        lower_name = str(friendly_name or "").lower()
        is_backup = "backup" in lower_id or "backup" in lower_name
        is_sun = lower_id.startswith("sensor.sun_") or lower_id.startswith("sun.") or " sun " in f" {lower_name} "
        is_weather = lower_id.startswith("weather.") or "weather" in lower_id or "wetter" in lower_name
        is_system = (
            is_backup
            or is_sun
            or is_weather
            or lower_id.startswith("update.")
            or lower_id.startswith("zone.")
            or "home assistant" in lower_name
        )

        if has_any_term(entity_id, alexa_terms) or has_any_term(friendly_name, alexa_terms):
            summary["alexa_detected"] = True
            translator["integrations"]["alexa"] = True
            if "echo" in lower_id or "echo" in lower_name:
                echo_by_name.setdefault(normalize_echo_name(entry["name"]), entry)
            else:
                alexa_visible_by_name[entry["name"]] = entry

        if domain == "media_player":
            android_candidates = [
                entity_id,
                friendly_name,
                attributes.get("app_id", ""),
                attributes.get("app_name", ""),
                attributes.get("source", ""),
                attributes.get("manufacturer", ""),
                attributes.get("model_name", ""),
            ]
            if any(has_any_term(value, android_tv_terms) for value in android_candidates):
                summary["android_tv_detected"] = True
                translator["integrations"]["android_tv"] = True
            media_by_name.setdefault(entry["name"], entry)
            summary["groups"]["televisions"]["entities"].append(entry)

        if domain == "light":
            summary["groups"]["lights"]["entities"].append(entry)
            translator["real_devices"]["lights"].append(entry)
        if domain in ("sensor", "binary_sensor"):
            summary["groups"]["sensors"]["entities"].append(entry)
            if is_backup:
                translator["technical_entities"]["backup_sensors"].append(entry)
            elif is_sun:
                translator["technical_entities"]["sun_sensors"].append(entry)
            elif is_weather:
                translator["technical_entities"]["weather_sensors"].append(entry)
            elif is_system:
                translator["technical_entities"]["system_sensors"].append(entry)
            else:
                classify_sensor(entry, translator["sensor_groups"])
        if domain == "device_tracker":
            summary["groups"]["mobile_devices"]["entities"].append(entry)
            translator["real_devices"]["mobile_devices"].append(entry)

    translator["real_devices"]["tvs"] = list(media_by_name.values())
    translator["real_devices"]["echo_devices"] = list(echo_by_name.values())
    translator["technical_entities"]["alexa_visible_devices"] = list(alexa_visible_by_name.values())
    dedupe_translator_devices(translator)
    build_capabilities(translator)

    for group in summary["groups"].values():
        group["count"] = len(group["entities"])
        group["examples"] = [entity["name"] for entity in group["entities"][:3]]

    LAST_ANALYSIS_AT = datetime.now(timezone.utc).isoformat()
    summary["scanned_at"] = LAST_ANALYSIS_AT
    summary["home_assistant_url"] = (os.environ.get("HOME_ASSISTANT_URL") or RUNTIME_HOME_ASSISTANT_URL or "").rstrip("/")
    summary["translator"] = translator
    summary["ha_status"] = infrastructure
    return summary


def classify_sensor(entry, groups):
    text = f"{entry['entity_id']} {entry['name']}".lower()
    if any(term in text for term in ["temperature", "temperatur", "humidity", "luftfeuchte", "illuminance", "beleuchtungsstarke", "lux"]):
        groups["climate_environment"].append(entry)
    elif any(term in text for term in ["motion", "bewegung", "presence", "präsenz", "occupancy", "door", "fenster", "tur"]):
        groups["motion_presence"].append(entry)
    elif any(term in text for term in ["energy", "energie", "power", "leistung", "battery", "batterie"]):
        groups["energy"].append(entry)
    elif any(term in text for term in ["pixel", "phone", "smartphone", "battery level", "charger"]):
        groups["smartphone"].append(entry)
    elif any(term in text for term in ["backup", "sun", "update", "system"]):
        groups["system"].append(entry)
    else:
        groups["other"].append(entry)


def normalize_echo_name(name):
    text = str(name or "").strip()
    suffixes = [
        " Konnektivität",
        " Sprechen",
        " Durchsagen",
        " Beleuchtungsstärke",
        " Nächster Wecker",
        " Nächste Erinnerung",
        " Nächster Timer",
        " Bitte nicht stören",
    ]
    for suffix in suffixes:
        if text.endswith(suffix):
            return text[: -len(suffix)]
    return text


def dedupe_translator_devices(translator):
    for section in ("real_devices", "technical_entities", "sensor_groups"):
        for key, entities in translator[section].items():
            if not isinstance(entities, list):
                continue
            seen = set()
            unique = []
            for entity in entities:
                marker = entity["name"] if key == "tvs" else entity["entity_id"]
                if marker in seen:
                    continue
                seen.add(marker)
                unique.append(entity)
            translator[section][key] = unique


def build_capabilities(translator):
    caps = []
    if translator["real_devices"]["lights"]:
        caps.append("Lichtsteuerung")
    if translator["real_devices"]["tvs"]:
        caps.append("Fernseher / Mediensteuerung")
    if translator["integrations"]["alexa"]:
        caps.append("Alexa Sprachsteuerung")
    if translator["real_devices"]["mobile_devices"]:
        caps.append("Smartphone-Anwesenheit")
    translator["capabilities"] = caps


def fetch_home_assistant_services(base_url, token):
    request = urllib.request.Request(
        f"{base_url}/api/services",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_home_assistant_states(base_url, token):
    request = urllib.request.Request(
        f"{base_url}/api/states",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))


def find_permit_join_switch(states):
    for entry in states:
        entity_id = entry.get("entity_id", "")
        if entity_id.startswith("switch.") and "permit_join" in entity_id.lower():
            return entity_id
    return None


def verify_entity_state(base_url, token, entity_id, expected_state, attempts=4, delay_seconds=1):
    for _ in range(attempts):
        time.sleep(delay_seconds)
        try:
            states = fetch_home_assistant_states(base_url, token)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
            continue
        match = next((entry for entry in states if entry.get("entity_id") == entity_id), None)
        if match and match.get("state") == expected_state:
            return True
    return False


def call_home_assistant_service(base_url, token, domain, service, data=None):
    request = urllib.request.Request(
        f"{base_url}/api/services/{domain}/{service}",
        data=json.dumps(data or {}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_home_assistant_analysis():
    base_url = (os.environ.get("HOME_ASSISTANT_URL") or RUNTIME_HOME_ASSISTANT_URL or "").rstrip("/")
    token = os.environ.get("HOME_ASSISTANT_TOKEN") or RUNTIME_HOME_ASSISTANT_TOKEN

    if not base_url:
        return {"ok": False, "error": "Home Assistant nicht verbunden", "needs_connection": True, "analysis": None}

    if not token:
        return {"ok": False, "error": "Home Assistant Token fehlt", "needs_connection": True, "analysis": None}

    try:
        states = fetch_home_assistant_states(base_url, token)
        services = fetch_home_assistant_services(base_url, token)
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            return {"ok": False, "error": "Token ungültig oder abgelaufen", "needs_connection": True, "analysis": None}
        return {"ok": False, "error": "Home Assistant nicht erreichbar", "needs_connection": False, "analysis": None}
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return {"ok": False, "error": "Home Assistant nicht erreichbar", "needs_connection": False, "analysis": None}

    infrastructure = detect_infrastructure(states, services)
    analysis = scan_home_assistant_states(states, infrastructure)
    return {
        "ok": True,
        "error": None,
        "needs_connection": False,
        "analysis": analysis,
        "ha_status": infrastructure,
        "capabilities": build_capability_map(infrastructure, connected=True),
    }


def test_home_assistant_connection(base_url, token):
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/api/",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            response.read()
        return {"ok": True, "error": None}
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            return {"ok": False, "error": "Token ungültig oder abgelaufen"}
        return {"ok": False, "error": "Home Assistant nicht erreichbar"}
    except (urllib.error.URLError, TimeoutError):
        return {"ok": False, "error": "Home Assistant nicht erreichbar"}


def configured_home_assistant():
    return (
        (os.environ.get("HOME_ASSISTANT_URL") or RUNTIME_HOME_ASSISTANT_URL or "").rstrip("/"),
        os.environ.get("HOME_ASSISTANT_TOKEN") or RUNTIME_HOME_ASSISTANT_TOKEN,
    )


def home_assistant_devices_url():
    url, _ = configured_home_assistant()
    base_url = url or os.environ.get("HOME_ASSISTANT_URL") or "http://homeassistant.local:8123"
    return f"{base_url.rstrip('/')}/config/devices/dashboard"


def home_assistant_action_ready():
    url, token = configured_home_assistant()
    if not url:
        return False, "Home Assistant nicht verbunden"
    if not token:
        return False, "Home Assistant Token fehlt"
    return True, None


def find_device(category: str, manufacturer: str, model: str, connection: str):
    exact = [
        device
        for device in DEVICE_DATABASE
        if device["category"] == category
        and device["manufacturer"] == manufacturer
        and device["model"] == model
        and device["connection"] == connection
    ]
    if exact:
        return exact[0]

    compatible_model = [
        device
        for device in DEVICE_DATABASE
        if device["category"] == category
        and device["manufacturer"] == manufacturer
        and device["model"] == model
    ]
    if compatible_model:
        return {"known_device": compatible_model[0], "connection_mismatch": True}

    manufacturer_match = [
        device
        for device in DEVICE_DATABASE
        if device["category"] == category and device["manufacturer"] == manufacturer
    ]
    if manufacturer_match:
        return {"known_device": manufacturer_match[0], "unknown_model": True}

    return None


def compatibility_check(category: str, manufacturer: str, model: str, connection: str, ha_status: dict | None = None):
    ha_status = ha_status or DEFAULT_HA_STATUS
    match = find_device(category, manufacturer, model, connection)
    if not match:
        return {
            "status": "unclear",
            "title": "Gerät nicht in der Datenbank",
            "reason": "Für diese Kombination aus Hersteller, Modell und Verbindung liegen noch keine belastbaren Daten vor.",
            "next_step": "Hersteller, Modellnummer und Funkstandard prüfen oder das Gerät manuell als neues Datenbankprofil ergänzen.",
            "device": None,
            "checks": [
                {"label": "Gerätedatenbank", "state": "unknown", "detail": "Kein passender Eintrag gefunden."}
            ],
            "missing": [],
            "possible_integrations": [],
        }

    if isinstance(match, dict) and match.get("connection_mismatch"):
        device = match["known_device"]
        return {
            "status": "not_compatible",
            "title": "Verbindungstyp wird nicht unterstützt",
            "reason": f"{manufacturer} {model} ist bekannt, aber nicht mit {connection} in der Datenbank hinterlegt.",
            "next_step": f"Wähle einen bekannten Verbindungstyp für dieses Gerät, zum Beispiel {device['connection']}.",
            "device": device,
            "checks": [
                {"label": "Gerät bekannt", "state": "present", "detail": f"{manufacturer} {model}"},
                {"label": "Verbindung", "state": "missing", "detail": f"{connection} nicht unterstützt."},
            ],
            "missing": [],
            "possible_integrations": device["possible_integrations"],
        }

    if isinstance(match, dict) and match.get("unknown_model"):
        device = match["known_device"]
        return {
            "status": "unclear",
            "title": "Modell noch nicht eindeutig bekannt",
            "reason": f"{manufacturer} ist bekannt, aber das Modell {model} ist noch nicht sicher bewertet.",
            "next_step": "Modellnummer prüfen und mit der Gerätedatenbank abgleichen.",
            "device": None,
            "checks": [
                {"label": "Hersteller", "state": "present", "detail": manufacturer},
                {"label": "Modell", "state": "unknown", "detail": model},
            ],
            "missing": [],
            "possible_integrations": device["possible_integrations"],
        }

    device = match
    if device["compatibility_status"] == "not_supported":
        return {
            "status": "not_compatible",
            "title": "Gerät aktuell nicht integrierbar",
            "reason": "Die Gerätedatenbank markiert dieses Gerät aktuell als nicht kompatibel.",
            "next_step": "Alternative Verbindung oder anderes Gerät wählen.",
            "device": device,
            "checks": [
                {"label": "Kompatibilität", "state": "missing", "detail": "Nicht kompatibel."}
            ],
            "missing": [],
            "possible_integrations": device["possible_integrations"],
        }

    if device["compatibility_status"] == "unclear":
        return {
            "status": "unclear",
            "title": "Kompatibilität unklar",
            "reason": "Die Datenbank kennt das Gerät, bewertet die Integration aber noch nicht sicher.",
            "next_step": "Offizielle Home-Assistant-Integration und Community-Berichte prüfen.",
            "device": device,
            "checks": [
                {"label": "Kompatibilität", "state": "unknown", "detail": "Noch nicht verifiziert."}
            ],
            "missing": [],
            "possible_integrations": device["possible_integrations"],
        }

    checks = []
    missing = []
    for infra in device["required_infrastructure"]:
        present = ha_status.get(infra)
        state = "present" if present else "missing"
        checks.append(
            {
                "label": INFRA_LABELS.get(infra, infra),
                "state": state,
                "detail": "vorhanden" if present else "fehlt",
            }
        )
        if not present:
            missing.append(infra)

    if not checks:
        checks.append(
            {
                "label": "Zusätzliche Infrastruktur",
                "state": "present",
                "detail": "Keine zusätzliche Infrastruktur erforderlich.",
            }
        )

    if missing:
        labels = [INFRA_LABELS.get(item, item) for item in missing]
        return {
            "status": "missing_requirements",
            "title": "Voraussetzungen fehlen",
            "reason": f"Für diesen Integrationsweg fehlen: {', '.join(labels)}.",
            "next_step": f"Richte zuerst {labels[0]} ein und starte die Analyse danach erneut.",
            "device": device,
            "checks": checks,
            "missing": missing,
            "possible_integrations": device["possible_integrations"],
        }

    return {
        "status": "integratable",
        "title": "Gerät integrierbar",
        "reason": "Die benötigte Infrastruktur ist laut Analyse vorhanden.",
        "next_step": f"Nutze die Integration {device['possible_integrations'][0]} und starte danach die konkrete Geräteeinbindung.",
        "device": device,
        "checks": checks,
        "missing": [],
        "possible_integrations": device["possible_integrations"],
    }


DECISION_TREE = {
    "categories": [
        {"id": "licht", "title": "Licht", "icon": "lightbulb", "accent": "#f6b73c"},
        {"id": "fernseher", "title": "Fernseher", "icon": "tv", "accent": "#55c0f0"},
        {"id": "sensor", "title": "Sensor", "icon": "gauge", "accent": "#ff7f66"},
        {"id": "steckdose", "title": "Steckdose", "icon": "plug", "accent": "#41b883"},
        {"id": "heizung", "title": "Heizung", "icon": "thermostat", "accent": "#d97745"},
    ],
    "manufacturers": {
        "licht": ["Philips Hue", "IKEA Tradfri", "Aqara", "Shelly", "Tuya", "Sonstiger"],
        "fernseher": ["Samsung", "LG", "Sony", "Philips", "Android TV", "Sonstiger"],
        "sensor": ["Aqara", "Sonoff", "Shelly", "IKEA", "Tuya", "Sonstiger"],
        "steckdose": ["Shelly", "Sonoff", "Aqara", "IKEA", "Tuya", "Sonstiger"],
        "heizung": ["tado", "Homematic IP", "Bosch", "Aqara", "Tuya", "Sonstiger"],
    },
    "models": {
        "Philips Hue": ["Hue White", "Hue Ambiance", "Hue Lightstrip", "Hue Dimmer Switch", "Anderes Hue Modell"],
        "IKEA Tradfri": ["Tradfri Lampe", "Tradfri Steckdose", "Tradfri Fernbedienung", "Vallhorn Sensor"],
        "Aqara": ["Temperatur/Luftfeuchte", "Tür/Fenster Sensor", "Bewegungssensor", "Smart Plug", "Thermostat E1"],
        "Shelly": ["Shelly Plus 1", "Shelly Plug S", "Shelly Dimmer", "Shelly BLU Sensor", "Shelly TRV"],
        "Tuya": ["WLAN Gerät", "Zigbee Gerät", "Bluetooth Gerät", "Matter Gerät"],
        "Samsung": ["Tizen TV", "The Frame", "QLED", "Anderes Samsung Modell"],
        "LG": ["webOS TV", "OLED", "NanoCell", "Anderes LG Modell"],
        "Sony": ["Android TV", "Google TV", "Bravia", "Anderes Sony Modell"],
        "Philips": ["Android TV", "Saphi TV", "Hue Sync Gerät", "Anderes Philips Modell"],
        "Android TV": ["Android TV", "Google TV", "Chromecast", "Nvidia Shield"],
        "Sonoff": ["SNZB Sensor", "ZBMINI", "S26/S40 Plug", "POW", "THR"],
        "tado": ["Smart Thermostat", "Smart Radiator Thermostat", "Bridge X", "V3+ Bridge"],
        "Homematic IP": ["Heizkörperthermostat", "Wandthermostat", "Access Point Gerät"],
        "Bosch": ["Smart Home Thermostat", "Raumthermostat", "Controller II Gerät"],
        "Sonstiger": ["Modell bekannt", "Modell unbekannt"],
    },
    "connections": ["WLAN", "Zigbee", "Matter", "Bluetooth", "LAN", "Hersteller-Bridge"],
    "infrastructure": {
        "WLAN": [
            {
                "id": "same_network",
                "label": "Gerät ist im gleichen Netzwerk wie Home Assistant",
                "capability": "network_devices",
                "question": "Ist das Gerät im gleichen Netzwerk wie Home Assistant erreichbar?",
                "action": "Verbinde das Gerät mit dem gleichen WLAN/LAN oder prüfe VLAN- und Firewall-Regeln.",
            },
            {
                "id": "local_integration",
                "label": "Home Assistant Integration oder lokale API ist verfügbar",
                "capability": "integrations",
                "question": "Existiert für Hersteller oder Gerät eine Home Assistant Integration?",
                "action": "Prüfe zuerst Geräte & Dienste in Home Assistant und danach die offizielle Integrationsliste.",
            },
            {
                "id": "cloud_dependency",
                "label": "Cloud-Zwang wurde geprüft",
                "capability": "cloud_dependency",
                "question": "Kann das Gerät lokal gesteuert werden oder benötigt es eine Hersteller-Cloud?",
                "action": "Wenn nur Cloud-Steuerung möglich ist, markiere den Pfad als cloudabhängig oder wähle ein lokal integrierbares Gerät.",
            },
        ],
        "Zigbee": [
            {
                "id": "zigbee_stack",
                "label": "Zigbee2MQTT oder ZHA ist installiert",
                "capability": "zigbee_stack",
                "question": "Ist ZHA oder Zigbee2MQTT in Home Assistant vorhanden?",
                "action": "Installiere ZHA oder Zigbee2MQTT, bevor ein Zigbee-Gerät eingebunden werden kann.",
            },
            {
                "id": "zigbee_coordinator",
                "label": "Zigbee Coordinator ist verbunden",
                "capability": "zigbee_coordinator",
                "question": "Ist ein Zigbee Coordinator angeschlossen und online?",
                "action": "Zusätzliche Hardware erforderlich: Zigbee Coordinator anschließen und in Home Assistant einrichten.",
            },
            {
                "id": "mqtt",
                "label": "Bei Zigbee2MQTT ist MQTT konfiguriert",
                "capability": "mqtt",
                "question": "Ist MQTT für Zigbee2MQTT konfiguriert?",
                "action": "MQTT Broker installieren oder konfigurieren, wenn Zigbee2MQTT verwendet werden soll.",
            },
        ],
        "Matter": [
            {
                "id": "matter_server",
                "label": "Matter Server Add-on oder Integration ist vorhanden",
                "capability": "matter",
                "question": "Ist Matter in Home Assistant eingerichtet?",
                "action": "Matter Server Add-on oder Matter Integration einrichten.",
            },
            {
                "id": "thread_router",
                "label": "Thread Border Router ist bei Thread-Geräten verfügbar",
                "capability": "thread",
                "question": "Ist für Thread-Geräte ein Thread Border Router vorhanden?",
                "action": "Zusätzliche Hardware erforderlich, falls das Matter-Gerät Thread statt WLAN nutzt.",
            },
            {
                "id": "same_network",
                "label": "Gerät und Home Assistant sind im gleichen Netzwerk",
                "capability": "network_devices",
                "question": "Sind Gerät und Home Assistant im gleichen Netzwerk erreichbar?",
                "action": "Netzwerk, VLAN, mDNS und Firewall prüfen.",
            },
        ],
        "Bluetooth": [
            {
                "id": "bluetooth_adapter",
                "label": "Bluetooth Adapter oder Proxy ist verfügbar",
                "capability": "bluetooth",
                "question": "Ist Bluetooth oder ein Bluetooth Proxy in Home Assistant verfügbar?",
                "action": "Bluetooth Adapter aktivieren oder ESPHome Bluetooth Proxy bereitstellen.",
            },
            {
                "id": "bluetooth_range",
                "label": "Reichweite zum Gerät ist ausreichend",
                "capability": "bluetooth_range",
                "question": "Ist das Gerät zuverlässig in Bluetooth-Reichweite?",
                "action": "Bluetooth Proxy näher am Gerät platzieren oder auf Zigbee/Matter/WLAN ausweichen.",
            },
            {
                "id": "bluetooth_integration",
                "label": "Home Assistant Bluetooth Integration ist aktiv",
                "capability": "bluetooth_integration",
                "question": "Ist die Bluetooth Integration aktiv?",
                "action": "Bluetooth Integration in Home Assistant aktivieren.",
            },
        ],
        "LAN": [
            {
                "id": "known_ip",
                "label": "Gerät hat eine feste oder auffindbare IP-Adresse",
                "capability": "network_devices",
                "question": "Ist die IP-Adresse oder Netzwerkerkennung des Geräts bekannt?",
                "action": "Im Router nachsehen, feste IP vergeben oder Netzwerkerkennung prüfen.",
            },
            {
                "id": "local_control",
                "label": "Lokale Steuerung ist aktiviert",
                "capability": "local_api",
                "question": "Ist lokale Steuerung oder eine lokale API aktiviert?",
                "action": "Lokale Steuerung in der Hersteller-App oder Geräteoberfläche aktivieren.",
            },
            {
                "id": "firewall",
                "label": "Firewall blockiert Home Assistant nicht",
                "capability": "firewall",
                "question": "Kann Home Assistant das Gerät im Netzwerk erreichen?",
                "action": "Firewall-, VLAN- und mDNS-Regeln prüfen.",
            },
        ],
        "Hersteller-Bridge": [
            {
                "id": "bridge_reachable",
                "label": "Bridge ist im Netzwerk erreichbar",
                "capability": "bridge",
                "question": "Ist die Hersteller-Bridge im Netzwerk erreichbar?",
                "action": "Bridge einschalten, Netzwerk prüfen und ggf. feste IP vergeben.",
            },
            {
                "id": "bridge_paired",
                "label": "Bridge ist bereits mit dem Gerät gekoppelt",
                "capability": "bridge_devices",
                "question": "Ist das Gerät bereits mit der Bridge gekoppelt?",
                "action": "Gerät zuerst in der Hersteller-Bridge koppeln.",
            },
            {
                "id": "bridge_integration",
                "label": "Passende Home Assistant Integration ist installiert",
                "capability": "integrations",
                "question": "Ist die passende Bridge-Integration in Home Assistant vorhanden?",
                "action": "Bridge-Integration in Home Assistant einrichten, danach werden Geräte sichtbar.",
            },
        ],
    },
    "ha_status": DEFAULT_HA_STATUS,
    "device_database": DEVICE_DATABASE,
    "home_assistant_status": {
        "source": "Noch keine Home-Assistant-Verbindung",
        "capabilities": build_capability_map(DEFAULT_HA_STATUS, connected=False),
    },
    "compatibility": {
        "Aqara": ["Zigbee", "Matter", "Hersteller-Bridge"],
        "IKEA Tradfri": ["Zigbee", "Matter", "Hersteller-Bridge"],
        "Philips Hue": ["Zigbee", "Matter", "Hersteller-Bridge"],
        "Shelly": ["WLAN", "LAN", "Bluetooth"],
        "Sonoff": ["WLAN", "Zigbee", "LAN"],
        "Samsung": ["WLAN", "LAN"],
        "LG": ["WLAN", "LAN"],
        "Sony": ["WLAN", "LAN"],
        "Android TV": ["WLAN", "LAN"],
        "tado": ["WLAN", "Hersteller-Bridge", "Matter"],
        "Homematic IP": ["Hersteller-Bridge"],
        "Bosch": ["Hersteller-Bridge"],
    },
    "recommendations": {
        "WLAN": "Prüfe zuerst, ob Home Assistant das Gerät lokal erkennen kann. Wenn nur eine Cloud-Integration existiert, sollte die Empfehlung klar als cloudabhängig markiert werden.",
        "Zigbee": "Der nächste sinnvolle Pfad ist die Entscheidung zwischen ZHA und Zigbee2MQTT. Ohne Coordinator und MQTT-Grundlage sollten keine Geräteschritte gestartet werden.",
        "Matter": "Matter ist passend, wenn die Matter-Infrastruktur bereits steht. Bei Thread-Geräten ist der Border Router die entscheidende Voraussetzung.",
        "Bluetooth": "Bluetooth eignet sich für nahe Geräte oder mit Bluetooth-Proxies. Ohne stabile Reichweite ist WLAN, Zigbee oder Matter oft robuster.",
        "LAN": "LAN ist meist der stabilste lokale Pfad. Wichtig ist, ob der Hersteller eine lokale Integration oder dokumentierte API anbietet.",
        "Hersteller-Bridge": "Die Bridge übernimmt Pairing und Funknetz. Home Assistant sollte zuerst die Bridge integrieren, erst danach werden einzelne Geräte sichtbar.",
    },
}


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request, "tree": DECISION_TREE, "app_version": APP_VERSION})


@app.get("/api/decision-tree")
async def decision_tree():
    return DECISION_TREE


@app.get("/api/home-assistant-status")
async def home_assistant_status():
    url, token = configured_home_assistant()
    if not url or not token:
        return {"ha_status": DEFAULT_HA_STATUS, "home_assistant_status": DECISION_TREE["home_assistant_status"]}

    try:
        states = fetch_home_assistant_states(url, token)
        services = fetch_home_assistant_services(url, token)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return {"ha_status": DEFAULT_HA_STATUS, "home_assistant_status": DECISION_TREE["home_assistant_status"]}

    infrastructure = detect_infrastructure(states, services)
    return {
        "ha_status": infrastructure,
        "home_assistant_status": {
            "source": "Live Home-Assistant-Analyse",
            "capabilities": build_capability_map(infrastructure, connected=True),
        },
    }


@app.get("/api/home-assistant-scan")
async def home_assistant_scan():
    return fetch_home_assistant_analysis()


@app.get("/api/home-assistant-token-status")
async def home_assistant_token_status():
    url, token = configured_home_assistant()
    connected = False
    error = None
    if url and token:
        result = test_home_assistant_connection(url, token)
        connected = result["ok"]
        error = result["error"]
    return {
        "has_url": bool(url),
        "has_token": bool(token),
        "connected": connected,
        "error": error,
        "last_analysis_at": LAST_ANALYSIS_AT,
        "default_url": url or "http://homeassistant.local:8123",
    }


@app.post("/api/home-assistant-token")
async def set_home_assistant_token(payload: HomeAssistantTokenRequest):
    global RUNTIME_HOME_ASSISTANT_URL
    global RUNTIME_HOME_ASSISTANT_TOKEN
    url = (payload.url or os.environ.get("HOME_ASSISTANT_URL") or "").strip().rstrip("/")
    token = payload.token.strip()
    if not url:
        return {"ok": False, "error": "Home Assistant nicht erreichbar"}
    if not token:
        return {"ok": False, "error": "Home Assistant Token fehlt"}

    test_result = test_home_assistant_connection(url, token)
    if not test_result["ok"]:
        return test_result

    RUNTIME_HOME_ASSISTANT_URL = url
    RUNTIME_HOME_ASSISTANT_TOKEN = token
    save_home_assistant_config(url, token)
    return {"ok": True, "has_url": True, "has_token": True}


DEVICE_LIKE_DOMAINS = {
    "light", "switch", "sensor", "binary_sensor", "climate",
    "lock", "cover", "fan", "alarm_control_panel", "button",
}


@app.post("/api/home-assistant/zigbee/permit-join")
async def home_assistant_zigbee_permit_join(payload: ZigbeePermitJoinRequest | None = None):
    global LAST_ZIGBEE_PAIRING_STARTED_AT
    global PAIRING_KNOWN_ENTITY_IDS
    payload = payload or ZigbeePermitJoinRequest()
    duration = max(30, min(payload.duration, 300))
    ready, error = home_assistant_action_ready()
    if not ready:
        return {
            "ok": False,
            "status": "not_connected",
            "error": error,
            "message": "Automatischer Suchmodus ist vorbereitet, aber Home Assistant ist noch nicht verbunden.",
            "home_assistant_url": home_assistant_devices_url(),
        }

    url, token = configured_home_assistant()
    try:
        states = fetch_home_assistant_states(url, token)
        services = fetch_home_assistant_services(url, token)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return {
            "ok": False,
            "status": "error",
            "error": "Home Assistant nicht erreichbar",
            "message": "Suchmodus konnte nicht gestartet werden, Home Assistant ist gerade nicht erreichbar.",
            "home_assistant_url": home_assistant_devices_url(),
        }

    infrastructure = detect_infrastructure(states, services)

    try:
        if infrastructure["zha"]:
            call_home_assistant_service(url, token, "zha", "permit", {"duration": duration})
            backend = "ZHA"
        elif infrastructure["zigbee2mqtt"] and infrastructure["mqtt"]:
            backend = "Zigbee2MQTT"
            permit_switch = find_permit_join_switch(states)
            if permit_switch:
                call_home_assistant_service(url, token, "switch", "turn_on", {"entity_id": permit_switch})
                if not verify_entity_state(url, token, permit_switch, "on"):
                    return {
                        "ok": False,
                        "status": "error",
                        "error": "Zigbee-Coordinator hat nicht rechtzeitig reagiert",
                        "message": "Der Suchmodus-Befehl wurde an Zigbee2MQTT gesendet, aber der Zigbee-Coordinator hat innerhalb weniger Sekunden nicht bestätigt, dass der Suchmodus aktiv ist. Das deutet auf ein Coordinator-/Firmware-Problem hin, nicht auf ein SmartGuide-Problem — Zigbee2MQTT-Logs auf dem Host prüfen.",
                        "home_assistant_url": home_assistant_devices_url(),
                    }
            else:
                call_home_assistant_service(
                    url, token, "mqtt", "publish",
                    {
                        "topic": "zigbee2mqtt/bridge/request/permit_join",
                        "payload": json.dumps({"value": True, "time": duration}),
                    },
                )
        else:
            return {
                "ok": False,
                "status": "no_zigbee_stack",
                "error": "Kein Zigbee-Coordinator (ZHA oder Zigbee2MQTT) erkannt.",
                "message": "SmartGuide kennt die Home-Assistant-Verbindung, findet darin aber weder ZHA noch Zigbee2MQTT. Der Suchmodus kann so nicht automatisch gestartet werden.",
                "home_assistant_url": home_assistant_devices_url(),
            }
    except urllib.error.HTTPError as exc:
        return {
            "ok": False,
            "status": "error",
            "error": f"Home Assistant lehnte den Service-Aufruf ab (HTTP {exc.code})",
            "message": "Suchmodus konnte nicht gestartet werden.",
            "home_assistant_url": home_assistant_devices_url(),
        }
    except (urllib.error.URLError, TimeoutError):
        return {
            "ok": False,
            "status": "error",
            "error": "Home Assistant nicht erreichbar",
            "message": "Suchmodus konnte nicht gestartet werden, Home Assistant ist gerade nicht erreichbar.",
            "home_assistant_url": home_assistant_devices_url(),
        }

    PAIRING_KNOWN_ENTITY_IDS = {entry.get("entity_id") for entry in states if entry.get("entity_id")}
    LAST_ZIGBEE_PAIRING_STARTED_AT = datetime.now(timezone.utc).isoformat()
    return {
        "ok": True,
        "status": "started",
        "backend": backend,
        "message": f"Suchmodus wurde über {backend} für {duration} Sekunden gestartet.",
        "duration": duration,
        "started_at": LAST_ZIGBEE_PAIRING_STARTED_AT,
        "home_assistant_url": home_assistant_devices_url(),
    }


@app.get("/api/home-assistant/devices/recent")
async def home_assistant_recent_devices():
    ready, error = home_assistant_action_ready()
    if not ready:
        return {
            "ok": False,
            "status": "not_connected",
            "error": error,
            "items": [],
            "home_assistant_url": home_assistant_devices_url(),
        }

    url, token = configured_home_assistant()
    try:
        states = fetch_home_assistant_states(url, token)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return {
            "ok": False,
            "status": "scan_failed",
            "error": "Home Assistant nicht erreichbar",
            "items": [],
            "home_assistant_url": home_assistant_devices_url(),
        }

    if PAIRING_KNOWN_ENTITY_IDS is None:
        return {
            "ok": True,
            "status": "unknown",
            "message": "Noch kein Suchmodus gestartet, es gibt keinen Vergleichszeitpunkt für neue Geräte.",
            "items": [],
            "started_at": LAST_ZIGBEE_PAIRING_STARTED_AT,
            "home_assistant_url": home_assistant_devices_url(),
        }

    new_entities = [
        entry for entry in states
        if entry.get("entity_id")
        and entry["entity_id"] not in PAIRING_KNOWN_ENTITY_IDS
        and entry["entity_id"].split(".", 1)[0] in DEVICE_LIKE_DOMAINS
    ]

    if not new_entities:
        return {
            "ok": True,
            "status": "unknown",
            "message": "Noch kein neues Gerät gefunden. Home Assistant hat seit Suchmodus-Start keine neue Entität für diese Domänen gemeldet.",
            "items": [],
            "started_at": LAST_ZIGBEE_PAIRING_STARTED_AT,
            "home_assistant_url": home_assistant_devices_url(),
        }

    items = [
        {
            "entity_id": entry["entity_id"],
            "friendly_name": (entry.get("attributes") or {}).get("friendly_name") or entry["entity_id"],
            "domain": entry["entity_id"].split(".", 1)[0],
        }
        for entry in new_entities
    ]
    return {
        "ok": True,
        "status": "found",
        "message": f"{len(items)} neue Entität(en) seit Suchmodus-Start gefunden.",
        "items": items,
        "started_at": LAST_ZIGBEE_PAIRING_STARTED_AT,
        "home_assistant_url": home_assistant_devices_url(),
    }


@app.get("/api/device-database")
async def device_database():
    return {"devices": DEVICE_DATABASE}


@app.get("/api/compatibility-check")
async def compatibility_check_api(category: str, manufacturer: str, model: str, connection: str):
    status = await home_assistant_status()
    return compatibility_check(category, manufacturer, model, connection, status["ha_status"])
