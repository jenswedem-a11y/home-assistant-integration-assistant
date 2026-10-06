# SmartGuide

**Update (October 6, 2026): SmartGuide is now a Home Assistant add-on, and the interface is in English.**

SmartGuide is a guided assistant for adding smart home devices to Home Assistant. Pick a device (or search a catalog of 4,372 Zigbee devices by model number or Zigbee identifier), and SmartGuide checks your *actual* Home Assistant setup for what that device needs — Zigbee (ZHA or Zigbee2MQTT), MQTT, Matter, Thread, Bluetooth or a manufacturer bridge — tells you what's missing, and can start Zigbee pairing for you.

<img width="1527" height="1101" alt="SmartGuide start screen" src="https://github.com/user-attachments/assets/526a6a0e-c355-4875-8d06-2090eb769698" />

<img width="1527" height="556" alt="SmartGuide wizard" src="https://github.com/user-attachments/assets/971f5153-c4e1-4d21-a481-9a691c2d95a4" />

<sub>Screenshots show the previous (German) version; the layout is the same.</sub>

## Install as a Home Assistant add-on (recommended)

For Home Assistant OS and Supervised installations.

[![Add the SmartGuide add-on repository to your Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fjenswedem-a11y%2Fhome-assistant-integration-assistant)

1. Click the button above and confirm adding the repository. *(If it opens `homeassistant.local:8123` and that's not your address, change your instance URL once on [my.home-assistant.io](https://my.home-assistant.io/) via the pencil icon.)*
   Or manually: **Settings → Add-ons → Add-on Store → ⋮ → Repositories** and add `https://github.com/jenswedem-a11y/home-assistant-integration-assistant`
2. Find **SmartGuide** in the store, click **Install**, then **Start**.
3. Turn on **Show in sidebar** on the add-on's Info tab and open SmartGuide from the sidebar.

No configuration needed: the add-on connects to Home Assistant automatically (no URL, no access token). Supported: amd64 and aarch64 (e.g. Raspberry Pi 4/5). More in the [add-on documentation](smartguide/DOCS.md).

## Install with Docker

For Home Assistant Container/Core setups, or to run SmartGuide on another machine:

```bash
curl -fsSL https://raw.githubusercontent.com/jenswedem-a11y/home-assistant-integration-assistant/main/install.sh | bash
```

Requires Docker with the Compose plugin. The device catalog is built into the image, no database setup needed. Open http://localhost:8095 and connect your Home Assistant instance (URL + long-lived access token) in the browser.
📖 [Detailed installation guide](INSTALL.md)

## Status

✅ Home Assistant add-on (Ingress, automatic connection)
✅ English and German interface
✅ Live analysis of your Home Assistant setup
✅ Decision tree with requirements check
✅ Device catalog (4,372 real Zigbee devices)
✅ Zigbee detection, incl. starting pairing mode with verification
✅ MQTT detection

🚧 Matter / Z-Wave support
🚧 QR code scanning

📅 Next goal: broader protocol support beyond Zigbee (Matter, Z-Wave)

Feedback, bugs and device data corrections are welcome as [GitHub issues](https://github.com/jenswedem-a11y/home-assistant-integration-assistant/issues).

---

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
