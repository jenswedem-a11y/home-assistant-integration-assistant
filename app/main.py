import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
import urllib.error
import urllib.request

from fastapi import FastAPI, Request
from pydantic import BaseModel
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.i18n import LANGUAGE_COOKIE, normalize_language, resolve_language, strings, t, tn
from app.search import router as search_router

APP_VERSION = "0.9.0"

app = FastAPI(title="Smart Guide", version=APP_VERSION)
app.include_router(search_router)

app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.middleware("http")
async def ingress_only(request: Request, call_next):
    # Add-on requirement: only the Ingress proxy may talk to the app.
    if ADDON_MODE and (request.client is None or request.client.host != INGRESS_PROXY_IP):
        return PlainTextResponse("Forbidden", status_code=403)
    return await call_next(request)
templates = Jinja2Templates(directory="app/templates")

CONFIG_PATH = Path(os.environ.get("SMART_GUIDE_CONFIG_PATH", "/app/data/ha_config.json"))

# As a Home Assistant add-on, the Supervisor injects a token for its Core API
# proxy and serves the UI through Ingress; no manual connection setup needed.
SUPERVISOR_TOKEN = os.environ.get("SUPERVISOR_TOKEN")
ADDON_MODE = bool(SUPERVISOR_TOKEN)
SUPERVISOR_CORE_URL = "http://supervisor/core"
INGRESS_PROXY_IP = "172.30.32.2"
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
            "lights": {"entities": []},
            "televisions": {"entities": []},
            "sensors": {"entities": []},
            "voice_assistants": {"entities": []},
            "mobile_devices": {"entities": []},
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
            "area": attributes.get("area_name") or attributes.get("area_id"),
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
    summary["home_assistant_url"] = home_assistant_browser_url() or ("/" if ADDON_MODE else "")
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
        " Connectivity",
        " Speak",
        " Announce",
        " Illuminance",
        " Next alarm",
        " Next reminder",
        " Next timer",
        " Do not disturb",
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
        caps.append("light_control")
    if translator["real_devices"]["tvs"]:
        caps.append("media_control")
    if translator["integrations"]["alexa"]:
        caps.append("alexa_voice")
    if translator["real_devices"]["mobile_devices"]:
        caps.append("phone_presence")
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


def fetch_home_assistant_analysis(lang):
    base_url, token = configured_home_assistant()

    if not base_url:
        return {"ok": False, "error": t(lang, "error.ha_not_connected"), "needs_connection": True, "analysis": None}

    if not token:
        return {"ok": False, "error": t(lang, "error.ha_token_missing"), "needs_connection": True, "analysis": None}

    try:
        states = fetch_home_assistant_states(base_url, token)
        services = fetch_home_assistant_services(base_url, token)
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            return {"ok": False, "error": t(lang, "error.ha_token_invalid"), "needs_connection": True, "analysis": None}
        return {"ok": False, "error": t(lang, "error.ha_unreachable"), "needs_connection": False, "analysis": None}
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return {"ok": False, "error": t(lang, "error.ha_unreachable"), "needs_connection": False, "analysis": None}

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


def test_home_assistant_connection(base_url, token, lang):
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
            return {"ok": False, "error": t(lang, "error.ha_token_invalid")}
        return {"ok": False, "error": t(lang, "error.ha_unreachable")}
    except (urllib.error.URLError, TimeoutError):
        return {"ok": False, "error": t(lang, "error.ha_unreachable")}


def configured_home_assistant():
    if ADDON_MODE:
        return SUPERVISOR_CORE_URL, SUPERVISOR_TOKEN
    return (
        (os.environ.get("HOME_ASSISTANT_URL") or RUNTIME_HOME_ASSISTANT_URL or "").rstrip("/"),
        os.environ.get("HOME_ASSISTANT_TOKEN") or RUNTIME_HOME_ASSISTANT_TOKEN,
    )


def home_assistant_browser_url():
    """Home Assistant URL for links in the browser (not for API calls)."""
    if ADDON_MODE:
        # Ingress serves SmartGuide from the Home Assistant origin itself.
        return ""
    url, _ = configured_home_assistant()
    return url


def home_assistant_devices_url():
    base_url = home_assistant_browser_url()
    if not base_url and not ADDON_MODE:
        base_url = "http://homeassistant.local:8123"
    return f"{base_url.rstrip('/')}/config/devices/dashboard"


def home_assistant_action_ready(lang):
    url, token = configured_home_assistant()
    if not url:
        return False, t(lang, "error.ha_not_connected")
    if not token:
        return False, t(lang, "error.ha_token_missing")
    return True, None


CATEGORIES = [
    {"id": "light", "icon": "lightbulb", "accent": "#f6b73c"},
    {"id": "tv", "icon": "tv", "accent": "#55c0f0"},
    {"id": "sensor", "icon": "gauge", "accent": "#ff7f66"},
    {"id": "plug", "icon": "plug", "accent": "#41b883"},
    {"id": "heating", "icon": "thermostat", "accent": "#d97745"},
]

CONNECTIONS = ["wifi", "zigbee", "matter", "bluetooth", "lan", "bridge"]

# Requirement checks per connection: (check id, capability probed from Home Assistant).
# Labels, questions and actions live in app/locales as infra.<connection>.<check id>.*
INFRASTRUCTURE = {
    "wifi": [
        ("same_network", "network_devices"),
        ("local_integration", "integrations"),
        ("cloud_dependency", "cloud_dependency"),
    ],
    "zigbee": [
        ("zigbee_stack", "zigbee_stack"),
        ("zigbee_coordinator", "zigbee_coordinator"),
        ("mqtt", "mqtt"),
    ],
    "matter": [
        ("matter_server", "matter"),
        ("thread_router", "thread"),
        ("same_network", "network_devices"),
    ],
    "bluetooth": [
        ("bluetooth_adapter", "bluetooth"),
        ("bluetooth_range", "bluetooth_range"),
        ("bluetooth_integration", "bluetooth_integration"),
    ],
    "lan": [
        ("known_ip", "network_devices"),
        ("local_control", "local_api"),
        ("firewall", "firewall"),
    ],
    "bridge": [
        ("bridge_reachable", "bridge"),
        ("bridge_paired", "bridge_devices"),
        ("bridge_integration", "integrations"),
    ],
}


def offline_home_assistant_status(lang):
    return {
        "source": t(lang, "status.source_none"),
        "capabilities": build_capability_map(DEFAULT_HA_STATUS, connected=False),
    }


def build_decision_tree(lang):
    return {
        "categories": [{**category, "title": t(lang, f"category.{category['id']}")} for category in CATEGORIES],
        "connections": [{"id": connection, "title": t(lang, f"connection.{connection}")} for connection in CONNECTIONS],
        "infrastructure": {
            connection: [
                {
                    "id": check_id,
                    "capability": capability,
                    "label": t(lang, f"infra.{connection}.{check_id}.label"),
                    "question": t(lang, f"infra.{connection}.{check_id}.question"),
                    "action": t(lang, f"infra.{connection}.{check_id}.action"),
                }
                for check_id, capability in checks
            ]
            for connection, checks in INFRASTRUCTURE.items()
        },
        "recommendations": {connection: t(lang, f"recommendation.{connection}") for connection in CONNECTIONS},
        "ha_status": DEFAULT_HA_STATUS,
        "home_assistant_status": offline_home_assistant_status(lang),
    }


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    lang = resolve_language(request)
    response = templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "tree": build_decision_tree(lang),
            "app_version": APP_VERSION,
            "lang": lang,
            "i18n": {"lang": lang, "strings": strings(lang)},
            "app_config": {"managed_connection": ADDON_MODE},
            "t": lambda key, **params: t(lang, key, **params),
        },
    )
    if normalize_language(request.query_params.get("lang")):
        # Behind Ingress, scope the cookie to this add-on's path on the HA origin.
        cookie_path = request.headers.get("x-ingress-path") or "/"
        response.set_cookie(LANGUAGE_COOKIE, lang, max_age=365 * 24 * 3600, samesite="lax", path=cookie_path)
    return response


@app.get("/api/decision-tree")
async def decision_tree(request: Request):
    return build_decision_tree(resolve_language(request))


@app.get("/api/home-assistant-status")
async def home_assistant_status(request: Request):
    lang = resolve_language(request)
    url, token = configured_home_assistant()
    if not url or not token:
        return {"ha_status": DEFAULT_HA_STATUS, "home_assistant_status": offline_home_assistant_status(lang)}

    try:
        states = fetch_home_assistant_states(url, token)
        services = fetch_home_assistant_services(url, token)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return {"ha_status": DEFAULT_HA_STATUS, "home_assistant_status": offline_home_assistant_status(lang)}

    infrastructure = detect_infrastructure(states, services)
    return {
        "ha_status": infrastructure,
        "home_assistant_status": {
            "source": t(lang, "status.source_live"),
            "capabilities": build_capability_map(infrastructure, connected=True),
        },
    }


@app.get("/api/home-assistant-scan")
async def home_assistant_scan(request: Request):
    return fetch_home_assistant_analysis(resolve_language(request))


@app.get("/api/home-assistant-token-status")
async def home_assistant_token_status(request: Request):
    lang = resolve_language(request)
    url, token = configured_home_assistant()
    connected = False
    error = None
    if url and token:
        result = test_home_assistant_connection(url, token, lang)
        connected = result["ok"]
        error = result["error"]
    return {
        "managed": ADDON_MODE,
        "has_url": bool(url),
        "has_token": bool(token),
        "connected": connected,
        "error": error,
        "last_analysis_at": LAST_ANALYSIS_AT,
        "default_url": url or "http://homeassistant.local:8123",
    }


@app.post("/api/home-assistant-token")
async def set_home_assistant_token(payload: HomeAssistantTokenRequest, request: Request):
    global RUNTIME_HOME_ASSISTANT_URL
    global RUNTIME_HOME_ASSISTANT_TOKEN
    lang = resolve_language(request)
    if ADDON_MODE:
        return {"ok": False, "error": t(lang, "error.managed_connection")}
    url = (payload.url or os.environ.get("HOME_ASSISTANT_URL") or "").strip().rstrip("/")
    token = payload.token.strip()
    if not url:
        return {"ok": False, "error": t(lang, "error.ha_unreachable")}
    if not token:
        return {"ok": False, "error": t(lang, "error.ha_token_missing")}

    test_result = test_home_assistant_connection(url, token, lang)
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
async def home_assistant_zigbee_permit_join(request: Request, payload: ZigbeePermitJoinRequest | None = None):
    global LAST_ZIGBEE_PAIRING_STARTED_AT
    global PAIRING_KNOWN_ENTITY_IDS
    payload = payload or ZigbeePermitJoinRequest()
    duration = max(30, min(payload.duration, 300))
    lang = resolve_language(request)
    ready, error = home_assistant_action_ready(lang)
    if not ready:
        return {
            "ok": False,
            "status": "not_connected",
            "error": error,
            "message": t(lang, "pairing.api.not_connected_message"),
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
            "error": t(lang, "error.ha_unreachable"),
            "message": t(lang, "pairing.api.unreachable_message"),
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
                        "error": t(lang, "pairing.api.coordinator_timeout_error"),
                        "message": t(lang, "pairing.api.coordinator_timeout_message"),
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
                "error": t(lang, "pairing.api.no_stack_error"),
                "message": t(lang, "pairing.api.no_stack_message"),
                "home_assistant_url": home_assistant_devices_url(),
            }
    except urllib.error.HTTPError as exc:
        return {
            "ok": False,
            "status": "error",
            "error": t(lang, "pairing.api.service_rejected", code=exc.code),
            "message": t(lang, "pairing.api.start_failed"),
            "home_assistant_url": home_assistant_devices_url(),
        }
    except (urllib.error.URLError, TimeoutError):
        return {
            "ok": False,
            "status": "error",
            "error": t(lang, "error.ha_unreachable"),
            "message": t(lang, "pairing.api.unreachable_message"),
            "home_assistant_url": home_assistant_devices_url(),
        }

    PAIRING_KNOWN_ENTITY_IDS = {entry.get("entity_id") for entry in states if entry.get("entity_id")}
    LAST_ZIGBEE_PAIRING_STARTED_AT = datetime.now(timezone.utc).isoformat()
    return {
        "ok": True,
        "status": "started",
        "backend": backend,
        "message": t(lang, "pairing.api.started", backend=backend, duration=duration),
        "duration": duration,
        "started_at": LAST_ZIGBEE_PAIRING_STARTED_AT,
        "home_assistant_url": home_assistant_devices_url(),
    }


@app.get("/api/home-assistant/devices/recent")
async def home_assistant_recent_devices(request: Request):
    lang = resolve_language(request)
    ready, error = home_assistant_action_ready(lang)
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
            "error": t(lang, "error.ha_unreachable"),
            "items": [],
            "home_assistant_url": home_assistant_devices_url(),
        }

    if PAIRING_KNOWN_ENTITY_IDS is None:
        return {
            "ok": True,
            "status": "unknown",
            "message": t(lang, "pairing.api.no_baseline"),
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
            "message": t(lang, "pairing.api.nothing_new"),
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
        "message": tn(lang, "pairing.api.found", len(items)),
        "items": items,
        "started_at": LAST_ZIGBEE_PAIRING_STARTED_AT,
        "home_assistant_url": home_assistant_devices_url(),
    }
