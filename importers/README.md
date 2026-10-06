# Importers

Dieser Ordner enthaelt manuelle Importer fuer die SmartGuide Knowledge-Datenbank.

Fuer SmartGuide v0.1 ist ein manueller Zigbee2MQTT-Importer vorbereitet. Er kann entweder eine lokale JSON-Datei oder ein lokal vorhandenes `zigbee-herdsman-converters` Repository lesen und schreibt die Daten in die SQLite-Katalogdatei `catalog/smartguide.db`. Es gibt keinen Live-Download aus GitHub, keinen Scheduler, keine n8n-Integration und keine KI-Integration.

## Zigbee2MQTT-Importer

Standarddatei:

```bash
data/import/zigbee2mqtt_devices.sample.json
```

Zieldatei ist standardmaessig `catalog/smartguide.db` (wird bei Bedarf angelegt, andere Datei mit `--db`). Vorher den aktuellen Katalog bauen:

```bash
python3 tools/catalog.py build
```

Sample-Import ausfuehren:

```bash
python3 importers/zigbee2mqtt_importer.py --source sample
```

Eigene lokale Datei importieren:

```bash
python3 importers/zigbee2mqtt_importer.py --source sample data/import/meine_zigbee2mqtt_devices.json
```

Der Import ist idempotent ausgelegt. Bereits bekannte Geraete, Varianten, Kennungen, Quellen, Faehigkeiten und Kompatibilitaetseintraege werden aktualisiert statt doppelt angelegt.

## Import aus zigbee-herdsman-converters

Der ZHC-Import liest ein lokal geklontes und gebautes Repository. SmartGuide klont das Repository nicht automatisch und ruft keine externen Daten periodisch ab.

Repository neben SmartGuide bereitstellen:

```bash
git clone https://github.com/Koenkk/zigbee-herdsman-converters.git ../zigbee-herdsman-converters
cd ../zigbee-herdsman-converters
pnpm install --frozen-lockfile
pnpm run build
cd ../smart-guide
```

Danach den manuellen Import starten:

```bash
python3 importers/zigbee2mqtt_importer.py --source zhc --zhc-path ../zigbee-herdsman-converters
```

Der Python-Importer ruft intern `importers/zhc_export_devices.mjs` auf. Dieses Node-Hilfsskript liest `dist/devices/index.js` und nutzt `dist/index.js`, um die Device-Definitionen vorzubereiten. Wenn das ZHC-Repository noch nicht gebaut wurde, bricht der Import mit einer verstaendlichen Fehlermeldung ab.

## Lokale Abhaengigkeiten

Der Importer braucht nur die Python-Standardbibliothek (`sqlite3`). Fuer `--source zhc` wird zusaetzlich Node.js benoetigt, weil `zigbee-herdsman-converters` ein JavaScript/TypeScript-Projekt ist.

## Katalog ins Repository uebernehmen

Versioniert wird nicht die `.db`-Datei, sondern der komprimierte SQL-Seed. Nach einem Import:

```bash
python3 tools/catalog.py dump   # catalog/smartguide.db -> database/seed-devices.sql.gz
```

Beim naechsten `docker compose up -d --build` wird der Katalog aus dem Seed ins Image gebaut.
