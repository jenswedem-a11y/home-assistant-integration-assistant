# Installation

## Voraussetzungen

* Docker Engine mit Compose-Plugin (`docker compose version` sollte funktionieren). Docker Desktop unter macOS/Windows bringt das schon mit.
* Ca. 200 MB freier Speicherplatz.
* Netzwerkzugriff vom Rechner, auf dem SmartGuide läuft, zu deiner Home-Assistant-Instanz.

## Schnellinstallation

```bash
curl -fsSL https://raw.githubusercontent.com/jenswedem-a11y/home-assistant-integration-assistant/main/install.sh | bash
```

Lädt das Repository nach `~/smartguide`, baut die App und startet beide Container (App und Postgres-Datenbank). Die Gerätedatenbank (4.372 Geräte) wird beim ersten Start automatisch geladen — kein manueller Import nötig.

Danach **http://localhost:8095** öffnen.

### Eigenes Installationsverzeichnis oder Port

```bash
SMARTGUIDE_INSTALL_DIR=/opt/smartguide SMARTGUIDE_PORT=9000 \
  curl -fsSL https://raw.githubusercontent.com/jenswedem-a11y/home-assistant-integration-assistant/main/install.sh | bash
```

## Manuelle Installation

Wer kein Skript per `curl | bash` ausführen möchte:

```bash
git clone https://github.com/jenswedem-a11y/home-assistant-integration-assistant.git smartguide
cd smartguide
docker compose up -d --build
```

**http://localhost:8095** öffnen, sobald die Container laufen (`docker compose ps`).

## Erste Einrichtung

SmartGuide startet zunächst ohne Home-Assistant-Verbindung — das ist normal, kein Fehler. In der Weboberfläche die Verbindung einrichten:

* Home-Assistant-URL, z.B. `http://homeassistant.local:8123` oder `http://192.168.x.x:8123`
* Ein Long-Lived-Access-Token, erstellt in Home Assistant unter **Profil → Sicherheit → Long-Lived Access Tokens**

SmartGuide testet die Verbindung vor dem Speichern und legt sie in `data/ha_config.json` auf dem Host ab (nicht im Repository) — übersteht also Container-Neustarts und Rebuilds.

## Konfigurationsoptionen

Alle optional — SmartGuide läuft auch ganz ohne diese mit sinnvollen Standardwerten. Für eigene Werte eine `.env`-Datei neben `docker-compose.yml` anlegen:

| Variable | Standard | Zweck |
|---|---|---|
| `SMARTGUIDE_PORT` | `8095` | Host-Port für die Weboberfläche |
| `SMARTGUIDE_POSTGRES_PASSWORD` | `smartguide` | Postgres-Passwort (nur relevant, wenn der DB-Port über localhost hinaus freigegeben wird) |
| `HOME_ASSISTANT_URL` / `HOME_ASSISTANT_TOKEN` | *(nicht gesetzt)* | Home-Assistant-Verbindung vorab setzen statt über das Formular |

## Aktualisieren

```bash
curl -fsSL https://raw.githubusercontent.com/jenswedem-a11y/home-assistant-integration-assistant/main/install.sh | bash
```

Erneutes Ausführen des Install-Skripts holt den aktuellen Code und baut neu. Gerätedatenbank und gespeicherte Home-Assistant-Verbindung bleiben unberührt — beides liegt im `data/`-Verzeichnis, das das Skript nie anfasst.

## Deinstallieren

```bash
cd ~/smartguide   # oder dein eigenes SMARTGUIDE_INSTALL_DIR
docker compose down -v
cd ..
rm -rf smartguide
```

`down -v` entfernt auch das Postgres-Datenvolume. `-v` weglassen, um die Gerätedatenbank für eine spätere Neuinstallation zu behalten.

## Problembehandlung

**"address already in use" auf Port 8095**
Etwas anderes belegt den Port schon. Mit anderem Port installieren: `SMARTGUIDE_PORT=8199 curl ... | bash`.

**Docker oder Compose-Plugin nicht gefunden**
Docker installieren: [docs.docker.com/get-docker](https://docs.docker.com/get-docker/). Das Compose-Plugin ist in aktuellen Docker-Versionen bereits enthalten; bei älteren Installationen ggf. separat nachinstallieren (`apt install docker-compose-plugin` o.ä.).

**Verbindungstest zu Home Assistant schlägt fehl**
* Die URL muss *vom Rechner mit SmartGuide aus* erreichbar sein, nicht nur vom eigenen Browser — im Zweifel von dort aus `curl` testen.
* Long-Lived-Access-Tokens werden in Home Assistant nur einmal bei der Erstellung angezeigt. Verloren? Einfach einen neuen erstellen.
* Laufen Home Assistant und SmartGuide auf demselben Host in Docker, aber in unterschiedlichen Compose-Projekten, erreicht `localhost`/`127.0.0.1` im SmartGuide-Container Home Assistant nicht — stattdessen die LAN-IP des Hosts oder einen Docker-Netzwerk-Alias verwenden.

**Gerätedatenbank scheint nach der Installation leer**
Passiert nur, wenn `data/postgres` schon von einer vorherigen, unvollständigen Installation existierte (Postgres führt den Seed-Schritt nur bei einem *frischen* Datenverzeichnis aus). `data/postgres` löschen und neu installieren erzwingt einen sauberen Seed.
