# SYSTEM ARCHITECTURE – v0.1

## Purpose

This document describes the initial system architecture for the Home Assistant Integration Assistant.

Version 0.1 focuses on a narrow but useful goal:

Helping users integrate a single smart home device into Home Assistant through guided assistance.

The architecture is intentionally simple and designed to grow over time.

---

## Core Idea

The assistant does not replace Home Assistant, Zigbee2MQTT, MQTT, or existing integrations.

Instead, it acts as a guidance layer between the user and the existing smart home ecosystem.

```text
User
  ↓
Integration Assistant
  ↓
Guided Workflow
  ↓
Existing Smart Home Tools
  ↓
Home Assistant
```

---

## Main Components

### 1. User Interface

The user interface provides a simple guided flow.

Initial options:

- Integrate a device
- Select device type
- Select manufacturer
- Select model
- Follow setup instructions
- Confirm successful integration

Example:

```text
What would you like to integrate?

1. Light
2. Sensor
3. Smart Plug
4. Switch
```

---

### 2. Assistant Engine

The assistant engine controls the workflow.

Responsibilities:

- Ask the next relevant question
- Determine missing information
- Select the correct integration path
- Provide step-by-step guidance
- Detect when the process is complete

Example logic:

```text
If device type = Light
and manufacturer = IKEA
and protocol = Zigbee
then recommend Zigbee2MQTT or ZHA.
```

---

### 3. Device Knowledge Base

The device knowledge base stores structured information about supported devices.

Initial fields:

- Manufacturer
- Device model
- Device type
- Protocol
- Pairing method
- Reset instructions
- Supported integration methods
- Known limitations

Example:

```yaml
manufacturer: IKEA
model: TRÅDFRI
type: light
protocol: Zigbee
supported_integrations:
  - Zigbee2MQTT
  - ZHA
pairing_method: reset_and_join
```

---

### 4. Environment Detection

The assistant should check which components are available.

Initial checks:

- Home Assistant reachable
- MQTT broker reachable
- Zigbee2MQTT reachable
- ZHA present
- Coordinator available

In version 0.1 this can be done manually or semi-automatically.

Example:

```text
Detected:
✓ Home Assistant
✓ MQTT
✓ Zigbee2MQTT
✗ ZHA
```

---

### 5. Integration Layer

The integration layer connects the assistant to existing systems.

Initial targets:

- Home Assistant API
- Zigbee2MQTT frontend/API
- MQTT broker
- Configuration files

In version 0.1, many actions may still be manual instructions.

Future versions may automate these steps.

---

## v0.1 Architecture Diagram

```text
┌────────────────────┐
│       User         │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  User Interface    │
│  Guided Dialogue   │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Assistant Engine   │
│ Workflow Logic     │
└─────────┬──────────┘
          │
          ├───────────────┐
          ▼               ▼
┌────────────────────┐  ┌────────────────────┐
│ Device Knowledge   │  │ Environment Checks │
│ Base               │  │ HA / MQTT / Z2M    │
└─────────┬──────────┘  └─────────┬──────────┘
          │                       │
          └───────────┬───────────┘
                      ▼
            ┌────────────────────┐
            │ Integration Layer  │
            │ Existing Systems   │
            └─────────┬──────────┘
                      ▼
            ┌────────────────────┐
            │ Home Assistant     │
            │ Zigbee2MQTT / MQTT │
            └────────────────────┘
```

---

## Data Flow Example

### Use Case: Integrate an IKEA TRÅDFRI Lamp

```text
1. User selects "Light"
2. Assistant asks for manufacturer
3. User selects "IKEA"
4. Assistant asks for model
5. User selects "TRÅDFRI"
6. Assistant checks environment
7. Zigbee2MQTT and MQTT are detected
8. Assistant recommends Zigbee2MQTT
9. Assistant guides user through pairing
10. Device appears in Zigbee2MQTT
11. Device is exposed to Home Assistant
12. User assigns name and room
```

---

## Version 0.1 Scope

### Included

- Guided device onboarding
- Basic device knowledge base
- Basic environment checks
- Step-by-step instructions
- Zigbee device onboarding concept
- Home Assistant as target platform

### Not Included

- Full automation
- Complex diagnostics
- Automatic installation of components
- Infrastructure planning
- MCP integration
- Voice assistant integration
- Multi-user management
- Commercial features

---

## Future Extensions

Later versions may add:

- Direct Home Assistant API integration
- MQTT status checks
- Zigbee2MQTT API control
- Automatic pairing mode activation
- Device discovery
- Error diagnosis
- Documentation generation
- Architecture planning
- MCP support
- Web-based UI
- Local LLM support

---

## Design Principles

### 1. Goal-Oriented

The user starts with a goal, not with a technology.

Example:

```text
I want to connect a lamp.
```

not:

```text
I want to configure MQTT discovery.
```

---

### 2. Existing Tools First

The project should not replace existing open-source tools.

It should make them easier to use.

---

### 3. Transparent Guidance

The assistant should explain what it is doing and why.

---

### 4. Incremental Automation

Version 0.1 may provide instructions.

Later versions may automate safe steps.

---

### 5. User Control

The user should confirm important actions before they are executed.

---

## Summary

Version 0.1 focuses on one clear problem:

Helping users integrate a single smart home device into Home Assistant.

The architecture is intentionally modular so the project can later grow from simple device onboarding into a broader integration and planning assistant.
