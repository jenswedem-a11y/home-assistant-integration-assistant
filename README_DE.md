# SmartGuide

**Update (6. Oktober 2026): SmartGuide gibt es jetzt als Home-Assistant-Add-on, und die Oberfläche ist auch auf Englisch verfügbar.**

SmartGuide ist ein geführter Assistent, um Smarthome-Geräte in Home Assistant einzubinden. Gerät auswählen (oder im Katalog mit 4.372 Zigbee-Geräten nach Modellnummer oder Zigbee-Kennung suchen), und SmartGuide prüft deine *tatsächliche* Home-Assistant-Installation auf das, was das Gerät braucht — Zigbee (ZHA oder Zigbee2MQTT), MQTT, Matter, Thread, Bluetooth oder eine Hersteller-Bridge —, sagt dir, was fehlt, und kann den Zigbee-Kopplungsmodus für dich starten.

<img width="1527" height="1101" alt="SmartGuide Startbildschirm" src="https://github.com/user-attachments/assets/7ebc8f3d-c518-4ec1-a37c-3725489c82f8" />

<img width="1506" height="546" alt="SmartGuide Assistent" src="https://github.com/user-attachments/assets/a9ff93ed-cc60-4393-a095-fd837cbd26d0" />

## Installation als Home-Assistant-Add-on (empfohlen)

Für Home Assistant OS und Supervised-Installationen.

[![SmartGuide-Add-on-Repository zu Home Assistant hinzufügen](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fjenswedem-a11y%2Fhome-assistant-integration-assistant)

1. Auf den Button klicken und das Hinzufügen des Repositorys bestätigen. *(Öffnet sich `homeassistant.local:8123` und das ist nicht deine Adresse: einmalig auf [my.home-assistant.io](https://my.home-assistant.io/) über das Stift-Symbol die Adresse deiner Instanz eintragen.)*
   Oder manuell: **Einstellungen → Add-ons → Add-on Store → ⋮ → Repositories** und `https://github.com/jenswedem-a11y/home-assistant-integration-assistant` hinzufügen
2. **SmartGuide** im Store auswählen, **Installieren**, dann **Starten**.
3. Im Reiter Info des Add-ons **In Seitenleiste anzeigen** einschalten und SmartGuide über die Seitenleiste öffnen.

Keine Konfiguration nötig: Das Add-on verbindet sich automatisch mit Home Assistant (keine URL, kein Zugriffstoken). Unterstützt: amd64 und aarch64 (z. B. Raspberry Pi 4/5). Mehr in der [Add-on-Dokumentation](smartguide/DOCS.md) (Englisch).

## Installation mit Docker

Für Home Assistant Container/Core oder um SmartGuide auf einem anderen Rechner zu betreiben:

```bash
curl -fsSL https://raw.githubusercontent.com/jenswedem-a11y/home-assistant-integration-assistant/main/install.sh | bash
```

Benötigt Docker mit Compose-Plugin. Die Gerätedatenbank ist im Image enthalten, keine Datenbank-Einrichtung nötig. Danach http://localhost:8095 öffnen und die Home-Assistant-Verbindung (URL + Long-Lived Access Token) im Browser einrichten.
📖 [Ausführliche Installationsanleitung](INSTALL_DE.md)

## Status

✅ Home-Assistant-Add-on (Ingress, automatische Verbindung)
✅ Oberfläche auf Deutsch und Englisch
✅ Live-Analyse der Home-Assistant-Installation
✅ Entscheidungsbaum mit Voraussetzungsprüfung
✅ Gerätedatenbank (4.372 echte Zigbee-Geräte)
✅ Zigbee-Erkennung (inkl. Kopplungsmodus-Aktivierung mit Erfolgsverifikation)
✅ MQTT-Erkennung

🚧 Matter- / Z-Wave-Unterstützung
🚧 QR-Code-Erkennung

📅 Nächstes Ziel: Breitere Protokoll-Unterstützung über Zigbee hinaus (Matter, Z-Wave)

Feedback, Fehler und Korrekturen an Gerätedaten gerne als [GitHub-Issue](https://github.com/jenswedem-a11y/home-assistant-integration-assistant/issues).

---

# Home Assistant Integrationsassistent

## Vision

Home Assistant ist eine der leistungsfähigsten Smart-Home-Plattformen überhaupt. Gleichzeitig stellt die Einrichtung und Integration neuer Geräte viele Nutzer vor Herausforderungen.

Ziel dieses Projekts ist die Entwicklung eines geführten Assistenten, der Anwender Schritt für Schritt durch die Einrichtung, Erweiterung und Optimierung ihrer Smart-Home-Umgebung führt.

## Das Problem

Viele Anwender möchten lediglich einfache Ziele erreichen:

* Eine Lampe einbinden
* Einen Bewegungsmelder hinzufügen
* Von Philips Hue auf Zigbee umsteigen
* Zigbee2MQTT einrichten
* MQTT konfigurieren
* Matter-Geräte integrieren

Um diese Aufgaben zu lösen, müssen sie häufig Kenntnisse über folgende Themen erwerben:

* Home Assistant
* Zigbee
* MQTT
* Matter
* Docker
* Netzwerke
* Gerätekompatibilität

Für viele Nutzer entsteht dadurch eine hohe Einstiegshürde.

## Die Lösung

Der Integrationsassistent führt den Nutzer Schritt für Schritt durch eine Datenbank von über 4.000 echten Geräten, kombiniert mit einer Live-Analyse der tatsächlichen Home-Assistant-Umgebung — die Führung basiert also auf dem, was wirklich installiert ist, nicht auf Vermutungen.

Beispielhafter Ablauf:

1. Gerätekategorie wählen (z.B. Licht)
2. Hersteller wählen (z.B. IKEA)
3. Modell wählen (z.B. TRÅDFRI)
4. Der Assistent erkennt die reale Infrastruktur: Home Assistant, MQTT, Zigbee2MQTT
5. Der Assistent aktiviert den Kopplungsmodus und bestätigt, dass er wirklich aktiv wurde
6. Neu erschienene Geräte werden automatisch erkannt

## Entwicklungsphasen

### Phase 1 – Geräteeinbindung ✅ weitgehend abgeschlossen

Ziel: Einfache Integration einzelner Geräte.

Stand: Geführter Ablauf, Live-Gerätedatenbank, Live-Infrastrukturerkennung und verifizierte Zigbee-Kopplung sind implementiert und laufen produktiv.

### Phase 2 – Technologieintegration (in Arbeit)

Ziel: Unterstützung bei der Einrichtung weiterer Technologien über Zigbee hinaus — Matter, Z-Wave.

### Phase 3 – Planung und Beratung

Ziel: Unterstützung bei der Planung kompletter Smart-Home-Lösungen.

Beispiele:

* Hardwareempfehlungen
* Netzwerkkonzepte
* Zigbee-Netzplanung
* Serverplanung

### Phase 4 – Betrieb und Optimierung

Ziel: Unterstützung im laufenden Betrieb.

Beispiele:

* Fehleranalyse
* Überwachung
* Backups
* Dokumentation

## Open Source

Dieses Projekt wird als Open-Source-Initiative entwickelt.

Das Ziel ist nicht, Home Assistant oder bestehende Integrationen zu ersetzen.

Das Ziel ist es, den Einstieg zu erleichtern und Anwender bei der erfolgreichen Umsetzung ihrer Smart-Home-Projekte zu unterstützen.

## Langfristige Vision

Langfristig soll der Integrationsassistent als intelligente Schicht zwischen Anwender und Smart-Home-Technik fungieren.

Der Nutzer beschreibt sein Ziel. Der Assistent unterstützt bei:

* Planung
* Integration
* Konfiguration
* Dokumentation
* Fehleranalyse

Dadurch wird Smart Home auch für Anwender zugänglich, die keine Experten für Netzwerke, Docker, MQTT oder Zigbee sind.
