# SmartGuide

SmartGuide walks you through adding a new smart home device to Home Assistant:

1. Pick the device type, manufacturer and model (or search the built-in catalog of 4,372 Zigbee devices by model number or Zigbee identifier).
2. SmartGuide checks your Home Assistant setup for what that device needs: Zigbee (ZHA or Zigbee2MQTT), MQTT, Matter, Thread, Bluetooth or a manufacturer bridge.
3. You get a clear verdict - ready, missing requirements, or additional hardware needed - plus the next concrete step.
4. For Zigbee devices, SmartGuide can start pairing mode (ZHA or Zigbee2MQTT) and tells you when Home Assistant reports the new device.

## Usage

After installing and starting the add-on, open **SmartGuide** from the sidebar. There is nothing to configure: the add-on talks to Home Assistant through the Supervisor, so no URL or access token is needed.

The interface is available in English and German and follows your browser language. Use the EN/DE switch in the top right to change it.

## What SmartGuide changes in Home Assistant

SmartGuide only reads your setup (states and available services), with one exception: when you press **Start discovery in Home Assistant** in the Zigbee pairing step, it turns on pairing mode (`zha.permit`, or the Zigbee2MQTT permit-join switch / MQTT request) for up to two minutes.

## Known limitations

- The device catalog currently covers Zigbee devices (from Zigbee2MQTT / zigbee-herdsman-converters). Wi-Fi, Matter, Bluetooth and bridge devices go through the generic requirements check.
- Scanning QR codes is not available yet.

## Support

Questions, bugs and device data corrections: [GitHub issues](https://github.com/jenswedem-a11y/home-assistant-integration-assistant/issues).
