Smart Guide - Update (18.8.2026)

<img width="1527" height="1101" alt="grafik" src="https://github.com/user-attachments/assets/526a6a0e-c355-4875-8d06-2090eb769698" />


<img width="1527" height="556" alt="grafik" src="https://github.com/user-attachments/assets/971f5153-c4e1-4d21-a481-9a691c2d95a4" />


Status

✅ Home Assistant Verbindung (live, gegen echte Instanzen erkannt)
✅ Token speichern
✅ Geräteanalyse
✅ Entscheidungsbaum
✅ Gerätedatenbank (4.372 echte Geräte importiert)
✅ Zigbee-Erkennung (inkl. Pairing-Aktivierung mit Erfolgsverifikation)
✅ MQTT-Erkennung

🚧 Matter- / Z-Wave-Unterstützung
🚧 Aufräumen der alten statischen Geräteliste (Fallback-Altlast)

📅 Nächstes Ziel:
Breitere Protokoll-Unterstützung über Zigbee hinaus (Matter, Z-Wave)


## Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/jenswedem-a11y/home-assistant-integration-assistant/main/install.sh | bash
```

Requires Docker (with the Compose plugin). No manual setup needed — the device database (4,372 devices) seeds itself automatically. After it starts, open http://localhost:8095 and connect your Home Assistant instance directly in the browser.
📖 [Detailed installation guide](INSTALL.md)


# Home Assistant Integration Assistant

## Vision

Home Assistant is one of the most powerful smart home platforms available today. However, many users struggle with the complexity of device integration, protocols, infrastructure setup, and troubleshooting.

The goal of this project is to provide a guided integration assistant that helps users successfully build and operate their smart home environments.

---

## The Problem

Many users want to achieve simple goals such as:

* Connect a lamp
* Add a sensor
* Migrate from Philips Hue
* Set up Zigbee2MQTT
* Configure MQTT
* Connect Matter devices

Unfortunately, accomplishing these tasks often requires understanding:

* Home Assistant
* Zigbee
* MQTT
* Matter
* Docker
* Networking
* Device compatibility

This creates a significant barrier for new users.

---

## The Solution

The Integration Assistant guides users step by step through a device knowledge base of over 4,000 real devices, combined with a live read of the user's actual Home Assistant setup — so the guidance is based on what's really installed, not on what the user thinks is installed.

Example flow:

1. Select device category (e.g. Light)
2. Select manufacturer (e.g. IKEA)
3. Select model (e.g. TRÅDFRI)
4. The assistant detects the real infrastructure: Home Assistant, MQTT, Zigbee2MQTT
5. The assistant activates pairing mode and confirms it actually took effect
6. Newly appeared devices are surfaced automatically

---

## Development Phases

### Phase 1 – Device Integration ✅ Largely complete

Goal:

Help users integrate individual devices.

Status: guided flow, live device database, live infrastructure detection, and verified Zigbee pairing activation are all implemented and running.

### Phase 2 – Protocol Integration (in progress)

Goal:

Help users deploy technologies beyond Zigbee — Matter, Z-Wave.

### Phase 3 – Infrastructure Planning

Goal:

Help users design complete smart home systems.

Examples:

* Hardware recommendations
* Architecture planning
* Network design

### Phase 4 – Operations & Optimization

Goal:

Support users during daily operation.

Examples:

* Monitoring
* Backup validation
* Diagnostics
* Documentation

---

## Open Source First

This project is intended to be developed as an open-source solution.

The objective is not to replace Home Assistant or existing integrations.

The objective is to simplify adoption and integration.
