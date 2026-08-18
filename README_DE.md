Smart Guide - Entwicklungsstand (18.8.2026)

Status

✅ Home-Assistant-Verbindung (live, gegen echte Instanzen erkannt)
✅ Token speichern
✅ Geräteanalyse
✅ Entscheidungsbaum
✅ Gerätedatenbank (4.372 echte Geräte importiert)
✅ Zigbee-Erkennung (inkl. Kopplungsmodus-Aktivierung mit Erfolgsverifikation)
✅ MQTT-Erkennung

🚧 Matter- / Z-Wave-Unterstützung
🚧 Aufräumen der alten statischen Geräteliste (Fallback-Altlast)

📅 Nächstes Ziel:
Breitere Protokoll-Unterstützung über Zigbee hinaus (Matter, Z-Wave)

## Schnellstart

```bash
curl -fsSL https://raw.githubusercontent.com/jenswedem-a11y/home-assistant-integration-assistant/main/install.sh | bash
```

Benötigt Docker (mit Compose-Plugin). Keine manuelle Einrichtung nötig — die Gerätedatenbank (4.372 Geräte) füllt sich automatisch. Danach http://localhost:8095 öffnen und die Home-Assistant-Verbindung direkt im Browser einrichten.

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
