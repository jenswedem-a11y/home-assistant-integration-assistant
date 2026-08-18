# Geplante Datenquellen

SmartGuide soll später offene Quellen nutzen, um eine Geräte- und Knowledge-Datenbank aufzubauen. In v0.1 wird noch nichts importiert; diese Datei beschreibt nur die geplanten Quellen.

## Warum Produktname, Modellnummer und technische Kennung getrennt sind

Smart-Home-Geräte werden häufig unter unterschiedlichen Namen verkauft, obwohl sie technisch identisch oder sehr ähnlich sind. Gleichzeitig kann ein gleich klingender Produktname unterschiedliche Hardwarevarianten haben.

SmartGuide speichert diese Ebenen deshalb getrennt:

- Produktfamilie in `devices`
- konkrete Varianten in `device_variants`
- technische Kennungen in `device_identifiers`

Beispiel:

- Shopname: `Tuya Smart Plug`
- Modell: `TS011F`
- Manufacturer Name: `_TZ3000_xxxxxxxx`
- Zigbee Model: `TS011F`

Der Shopname ist für Nutzer verständlich, aber oft nicht eindeutig genug. Modellnummer und technische Kennungen helfen später, Kompatibilität zuverlässiger zu bewerten und White-Label-Geräte zusammenzuführen.

## Zigbee2MQTT Supported Devices

Die Zigbee2MQTT-Geräteliste ist eine wichtige Quelle für Zigbee-Geräte, unterstützte Modelle, Herstellerinformationen, Exposes und Hinweise zur Einbindung über Zigbee2MQTT.

Geplante Nutzung:

- Hersteller und Modellnamen normalisieren
- unterstützte Fähigkeiten ableiten
- Zigbee2MQTT-Kompatibilität dokumentieren
- technische Kennungen wie Zigbee Model und Manufacturer Name erfassen
- Quellinformationen in `device_sources` speichern

## Blakadder Zigbee Database

Die Blakadder-Datenbank enthält Community-Informationen zu Zigbee-Geräten, alternativen Modellbezeichnungen, Herstellern und unterstützten Gateways.

Geplante Nutzung:

- zusätzliche Modellaliase erkennen
- Geräteabdeckung mit Zigbee2MQTT vergleichen
- White-Label- und Rebranding-Hinweise ergänzen
- Hinweise zur Kompatibilität ergänzen

## Home Assistant Integrations / Brands

Home Assistant Integrations und Brands sind relevant, um Geräte mit offiziellen oder bekannten Integrationspfaden zu verknüpfen.

Geplante Nutzung:

- Plattformen und Integrationen in `device_compatibility` abbilden
- Hersteller- und Markeninformationen ergänzen
- Hinweise auf lokale oder Cloud-basierte Integrationen dokumentieren

## OpenSmartHouse Z-Wave Database

OpenSmartHouse kann später als Quelle für Z-Wave-Geräte ergänzt werden. Diese Quelle ist nicht Teil des ersten Prototyps, soll aber bei Erweiterung auf Z-Wave berücksichtigt werden.

Geplante Nutzung:

- Z-Wave-Hersteller und Modelle ergänzen
- Geräteeigenschaften und Kompatibilitätsinformationen übernehmen
- Z-Wave-spezifische Fähigkeiten modellieren
