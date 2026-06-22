# ROADMAP – Phase 1: Device Integration Assistant

## Goal

Enable users to successfully integrate a single device into Home Assistant without requiring technical knowledge.

---

## Supported Devices (MVP)

### Lighting

- [ ] IKEA TRÅDFRI
- [ ] Philips Hue
- [ ] Ledvance
- [ ] Innr

### Sensors

- [ ] Aqara Motion Sensor
- [ ] Aqara Temperature Sensor

### Smart Plugs

- [ ] IKEA Smart Plug
- [ ] Shelly Plug

---

## User Guidance

### Device Identification

- [ ] Ask for device type
- [ ] Ask for manufacturer
- [ ] Ask for model

Example:

What would you like to integrate?

1. Light
2. Sensor
3. Smart Plug
4. Switch

---

### Environment Detection

Check for:

- [ ] Home Assistant
- [ ] MQTT
- [ ] Zigbee2MQTT
- [ ] ZHA

---

### Integration Path Selection

Example:

IKEA TRÅDFRI detected

Available integrations:

- Zigbee2MQTT
- ZHA

Recommended:

- Zigbee2MQTT

---

### Step-by-Step Assistant

Step 1

Open Zigbee2MQTT

[Continue]

Step 2

Enable pairing mode

[Continue]

Step 3

Reset the lamp according to the manufacturer instructions

[Device Found]

---

## Knowledge Base

- [ ] Device information
- [ ] Manufacturer information
- [ ] Pairing instructions
- [ ] Compatibility information

---

## Success Criteria

A user can:

- Integrate a lamp
- Integrate a sensor
- Integrate a smart plug

without searching documentation or forums.

---

## Out of Scope for Phase 1

- Automations
- Dashboards
- MCP integrations
- AI agents
- Zigbee network planning
- Matter migration
- Infrastructure planning
- Advanced troubleshooting

---

## Core Problem Solved

'I bought a device. How do I get it working in Home Assistant?'
