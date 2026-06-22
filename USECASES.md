# USE CASES

## Introduction

This document describes real-world scenarios the Home Assistant Integration Assistant is intended to support.

The goal is to guide users from their desired outcome to a working solution while reducing technical complexity.

---

# Use Case 1 – Integrate a Zigbee Lamp

## Goal

A user wants to connect a new Zigbee lamp to Home Assistant.

### User

> I want to connect a new lamp.

### Assistant

> What manufacturer is the lamp from?

### User

> IKEA

### Assistant

> What model would you like to connect?

### User

> TRÅDFRI

### Assistant

> I detected:
>
> * Home Assistant
> * MQTT
> * Zigbee2MQTT
>
> Would you like to enable pairing mode?

### User

> Yes

### Assistant

> Pairing mode enabled.
>
> Please reset the lamp according to the manufacturer instructions.

### Assistant

> Device detected.
>
> What would you like to name it?

### User

> Living Room Lamp

### Result

Device successfully integrated into Home Assistant.

---

# Use Case 2 – Integrate a Motion Sensor

## Goal

A user wants to connect a Zigbee motion sensor.

### User

> I want to add a motion sensor.

### Assistant

> Which manufacturer?

### User

> Aqara

### Assistant

> I detected Zigbee2MQTT.
>
> Shall I enable pairing mode?

### User

> Yes

### Assistant

> Please press and hold the pairing button for 5 seconds.

### Result

Motion sensor successfully integrated.

---

# Use Case 3 – Migrate from Philips Hue

## Goal

A user wants to migrate from a Philips Hue Bridge to Zigbee2MQTT.

### User

> I want to move away from Philips Hue.

### Assistant

> I can help you migrate your devices to Zigbee2MQTT.
>
> How many Hue devices are currently connected?

### User

> 15

### Assistant

> Migration plan created.
>
> Estimated migration time: 30–60 minutes.

### Result

Migration plan generated.

---

# Use Case 4 – Install MQTT

## Goal

A user wants to start using Zigbee2MQTT but MQTT is not installed.

### User

> I want to use Zigbee2MQTT.

### Assistant

> MQTT broker not detected.
>
> Would you like assistance installing Mosquitto?

### User

> Yes

### Assistant

> Creating installation guide.

### Result

MQTT broker successfully installed.

---

# Use Case 5 – Troubleshoot Device Pairing

## Goal

A user cannot pair a Zigbee device.

### User

> My device is not found.

### Assistant

> Let's check the environment.
>
> Detected:
>
> * Zigbee2MQTT running
> * MQTT connected
> * Coordinator online
>
> Pairing mode currently disabled.

### Assistant

> Would you like me to enable pairing mode?

### Result

Issue identified and resolved.

---

# Future Use Cases

* Matter device onboarding
* Z-Wave onboarding
* Home Assistant installation
* Zigbee network optimization
* Infrastructure planning
* Backup validation
* Smart home architecture consulting
