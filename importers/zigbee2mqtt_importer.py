#!/usr/bin/env python3
"""Manual Zigbee2MQTT device importer for SmartGuide v0.1.

The importer intentionally reads local data only. It does not download data,
does not schedule jobs, and does not touch Home Assistant.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

SOURCE = "zigbee2mqtt"
DEFAULT_INPUT = "data/import/zigbee2mqtt_devices.sample.json"
ZHC_EXPORTER = Path(__file__).with_name("zhc_export_devices.mjs")


def sanitize_value(value: Any) -> Any:
    if isinstance(value, str):
        return value.replace("\x00", "")
    if isinstance(value, list):
        return [sanitize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: sanitize_value(nested) for key, nested in value.items()}
    return value


def load_devices(path: Path) -> list[dict[str, Any]]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except FileNotFoundError:
        raise SystemExit(f"Importdatei nicht gefunden: {path}")
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Importdatei ist kein gueltiges JSON: {exc}") from exc

    if isinstance(payload, dict):
        devices = payload.get("devices")
    else:
        devices = payload

    if not isinstance(devices, list):
        raise SystemExit("Importdatei muss eine JSON-Liste oder ein Objekt mit 'devices' enthalten.")

    return [sanitize_value(device) for device in devices if isinstance(device, dict)]


def load_zhc_devices(zhc_path: Path) -> list[dict[str, Any]]:
    if not zhc_path.exists():
        raise SystemExit(f"zigbee-herdsman-converters Pfad nicht gefunden: {zhc_path}")
    if not zhc_path.is_dir():
        raise SystemExit(f"zigbee-herdsman-converters Pfad ist kein Verzeichnis: {zhc_path}")
    if not (zhc_path / "package.json").exists():
        raise SystemExit(
            "Der angegebene Pfad sieht nicht wie ein zigbee-herdsman-converters Repository aus "
            f"(package.json fehlt): {zhc_path}"
        )
    if not ZHC_EXPORTER.exists():
        raise SystemExit(f"ZHC Export-Hilfsskript fehlt: {ZHC_EXPORTER}")

    with tempfile.NamedTemporaryFile("r", encoding="utf-8", suffix=".json", delete=False) as handle:
        output_path = Path(handle.name)

    try:
        result = subprocess.run(
            ["node", str(ZHC_EXPORTER), "--zhc-path", str(zhc_path), "--output", str(output_path)],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            message = result.stderr.strip() or result.stdout.strip() or "Unbekannter Fehler beim ZHC-Export."
            raise SystemExit(message)
        return load_devices(output_path)
    except FileNotFoundError as exc:
        raise SystemExit(
            "Node.js wurde nicht gefunden. Fuer den ZHC-Import wird Node.js benoetigt, "
            "weil zigbee-herdsman-converters ein TypeScript/JavaScript-Projekt ist."
        ) from exc
    finally:
        output_path.unlink(missing_ok=True)


def require_database_url() -> str:
    database_url = os.getenv("SMARTGUIDE_DATABASE_URL")
    if not database_url:
        raise SystemExit(
            "SMARTGUIDE_DATABASE_URL fehlt. Beispiel: "
            "export SMARTGUIDE_DATABASE_URL='postgresql://smartguide:<passwort>@localhost:5433/smartguide'"
        )
    return database_url


def import_psycopg() -> Any:
    try:
        import psycopg
        from psycopg.types.json import Json
    except ImportError as exc:
        raise SystemExit(
            "Python-Paket 'psycopg' fehlt. Installiere es fuer den manuellen Import, "
            "z.B. mit: python3 -m pip install 'psycopg[binary]'"
        ) from exc

    return psycopg, Json


def as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def text_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def infer_device_type(device: dict[str, Any]) -> str | None:
    explicit = text_or_none(device.get("device_type") or device.get("category"))
    if explicit:
        return explicit

    haystack = " ".join(
        str(part).lower()
        for part in [
            device.get("model"),
            device.get("description"),
            json.dumps(device.get("exposes", []), ensure_ascii=True),
        ]
        if part is not None
    )

    if any(term in haystack for term in ["plug", "outlet", "socket", "steckdose"]):
        return "plug"
    if any(term in haystack for term in ["motion", "occupancy", "presence", "bewegung"]):
        return "sensor"
    if any(term in haystack for term in ["bulb", "light", "lamp"]):
        return "light"
    if "switch" in haystack:
        return "switch"
    return None


def source_url_for(device: dict[str, Any], model: str) -> str:
    source_url = text_or_none(device.get("source_url"))
    if source_url:
        return source_url
    return f"https://www.zigbee2mqtt.io/devices/{model}.html"


def upsert_device(cursor: Any, device: dict[str, Any]) -> int:
    vendor = text_or_none(device.get("vendor")) or "Unknown"
    model = text_or_none(device.get("model")) or text_or_none(device.get("model_number"))
    if not model:
        raise ValueError("Gerät ohne model/model_number kann nicht importiert werden.")

    display_name = text_or_none(device.get("display_name")) or f"{vendor} {model}"
    description = text_or_none(device.get("description"))
    device_type = infer_device_type(device)

    cursor.execute(
        """
        INSERT INTO devices (
            canonical_vendor,
            canonical_model,
            display_name,
            protocol,
            device_type,
            description,
            confidence,
            updated_at
        )
        VALUES (%s, %s, %s, 'zigbee', %s, %s, %s, now())
        ON CONFLICT (canonical_vendor, canonical_model)
        DO UPDATE SET
            display_name = EXCLUDED.display_name,
            protocol = EXCLUDED.protocol,
            device_type = EXCLUDED.device_type,
            description = EXCLUDED.description,
            confidence = GREATEST(devices.confidence, EXCLUDED.confidence),
            updated_at = now()
        RETURNING id
        """,
        (vendor, model, display_name, device_type, description, 0.9000),
    )
    return int(cursor.fetchone()[0])


def upsert_variant(cursor: Any, device_id: int, device: dict[str, Any]) -> int:
    model = text_or_none(device.get("model")) or text_or_none(device.get("model_number"))
    variant_name = text_or_none(device.get("variant_name")) or model

    cursor.execute(
        """
        INSERT INTO device_variants (
            device_id,
            variant_name,
            model_number,
            hardware_version,
            firmware_version,
            region,
            notes,
            confidence,
            updated_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
        ON CONFLICT (device_id, variant_name, model_number)
        DO UPDATE SET
            hardware_version = COALESCE(EXCLUDED.hardware_version, device_variants.hardware_version),
            firmware_version = COALESCE(EXCLUDED.firmware_version, device_variants.firmware_version),
            region = COALESCE(EXCLUDED.region, device_variants.region),
            notes = COALESCE(EXCLUDED.notes, device_variants.notes),
            confidence = GREATEST(device_variants.confidence, EXCLUDED.confidence),
            updated_at = now()
        RETURNING id
        """,
        (
            device_id,
            variant_name,
            model,
            text_or_none(device.get("hardware_version")),
            text_or_none(device.get("firmware_version")),
            text_or_none(device.get("region")),
            text_or_none(device.get("notes")),
            0.9000,
        ),
    )
    return int(cursor.fetchone()[0])


def upsert_identifier(
    cursor: Any,
    variant_id: int,
    identifier_type: str,
    identifier_value: str | None,
    confidence: float = 0.9000,
) -> None:
    if not identifier_value:
        return

    cursor.execute(
        """
        INSERT INTO device_identifiers (
            variant_id,
            identifier_type,
            identifier_value,
            source,
            confidence
        )
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (variant_id, identifier_type, identifier_value, source)
        DO UPDATE SET confidence = GREATEST(device_identifiers.confidence, EXCLUDED.confidence)
        """,
        (variant_id, identifier_type, identifier_value, SOURCE, confidence),
    )


def import_identifiers(cursor: Any, variant_id: int, device: dict[str, Any]) -> None:
    model = text_or_none(device.get("model")) or text_or_none(device.get("model_number"))
    upsert_identifier(cursor, variant_id, "model_number", model)

    for zigbee_model in as_list(device.get("zigbeeModel") or device.get("zigbee_model")):
        upsert_identifier(cursor, variant_id, "zigbee_model", text_or_none(zigbee_model))

    for fingerprint in as_list(device.get("fingerprint")):
        if not isinstance(fingerprint, dict):
            continue
        upsert_identifier(cursor, variant_id, "zigbee_model", text_or_none(fingerprint.get("modelID")))
        upsert_identifier(
            cursor,
            variant_id,
            "manufacturer_name",
            text_or_none(fingerprint.get("manufacturerName")),
        )

    for white_label in as_list(device.get("whiteLabel") or device.get("white_label")):
        if isinstance(white_label, dict):
            vendor = text_or_none(white_label.get("vendor"))
            label_model = text_or_none(white_label.get("model"))
            label = " ".join(part for part in [vendor, label_model] if part)
        else:
            label = text_or_none(white_label)
        upsert_identifier(cursor, variant_id, "white_label", label, 0.7000)


def upsert_source(cursor: Any, Json: Any, device_id: int, device: dict[str, Any]) -> None:
    vendor = text_or_none(device.get("vendor"))
    model = text_or_none(device.get("model")) or text_or_none(device.get("model_number"))

    cursor.execute(
        """
        INSERT INTO device_sources (
            device_id,
            source,
            source_vendor,
            source_model,
            source_url,
            raw_data,
            last_seen_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, now())
        ON CONFLICT (device_id, source, source_model)
        DO UPDATE SET
            source_vendor = EXCLUDED.source_vendor,
            source_url = EXCLUDED.source_url,
            raw_data = EXCLUDED.raw_data,
            last_seen_at = now()
        """,
        (device_id, SOURCE, vendor, model, source_url_for(device, model or ""), Json(device)),
    )


def capability_name(expose: Any, index: int) -> str:
    if isinstance(expose, dict):
        name = text_or_none(expose.get("property") or expose.get("name") or expose.get("type"))
        if name:
            return f"expose:{name}"
    return f"expose:{index}"


def upsert_capabilities(cursor: Any, Json: Any, device_id: int, device: dict[str, Any]) -> None:
    exposes = as_list(device.get("exposes"))
    if not exposes:
        return

    for index, expose in enumerate(exposes, start=1):
        cursor.execute(
            """
            INSERT INTO device_capabilities (device_id, capability, value, source)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (device_id, capability, source)
            DO UPDATE SET value = EXCLUDED.value
            """,
            (device_id, capability_name(expose, index), Json(expose), SOURCE),
        )


def upsert_compatibility(cursor: Any, device_id: int, device: dict[str, Any]) -> None:
    notes = text_or_none(device.get("compatibility_notes")) or "Definition exists in Zigbee2MQTT data."

    cursor.execute(
        """
        INSERT INTO device_compatibility (device_id, platform, supported, notes, source)
        VALUES (%s, 'zigbee2mqtt', true, %s, %s)
        ON CONFLICT (device_id, platform, source)
        DO UPDATE SET
            supported = EXCLUDED.supported,
            notes = EXCLUDED.notes
        """,
        (device_id, notes, SOURCE),
    )


def create_import_run(cursor: Any, items_seen: int) -> int:
    cursor.execute(
        """
        INSERT INTO import_runs (source, status, items_seen)
        VALUES (%s, 'running', %s)
        RETURNING id
        """,
        (SOURCE, items_seen),
    )
    return int(cursor.fetchone()[0])


def finish_import_run(
    cursor: Any,
    run_id: int,
    status: str,
    items_imported: int,
    error_message: str | None = None,
) -> None:
    cursor.execute(
        """
        UPDATE import_runs
        SET status = %s,
            finished_at = now(),
            items_imported = %s,
            error_message = %s
        WHERE id = %s
        """,
        (status, items_imported, error_message, run_id),
    )


def get_import_devices(args: argparse.Namespace) -> list[dict[str, Any]]:
    if args.source == "sample":
        return load_devices(Path(args.input))

    if args.source == "zhc":
        if not args.zhc_path:
            raise SystemExit(
                "--zhc-path fehlt. Beispiel: "
                "python3 importers/zigbee2mqtt_importer.py --source zhc --zhc-path ../zigbee-herdsman-converters"
            )
        return load_zhc_devices(Path(args.zhc_path))

    raise SystemExit(f"Unbekannte Quelle: {args.source}")


def run_import(args: argparse.Namespace) -> int:
    database_url = require_database_url()
    devices = get_import_devices(args)
    psycopg, Json = import_psycopg()

    imported = 0
    connection = psycopg.connect(database_url)
    try:
        with connection.cursor() as cursor:
            run_id = create_import_run(cursor, len(devices))
        connection.commit()

        try:
            with connection.cursor() as cursor:
                for device in devices:
                    device_id = upsert_device(cursor, device)
                    variant_id = upsert_variant(cursor, device_id, device)
                    import_identifiers(cursor, variant_id, device)
                    upsert_source(cursor, Json, device_id, device)
                    upsert_capabilities(cursor, Json, device_id, device)
                    upsert_compatibility(cursor, device_id, device)
                    imported += 1

                finish_import_run(cursor, run_id, "success", imported)
            connection.commit()
        except Exception as exc:
            connection.rollback()
            with connection.cursor() as cursor:
                finish_import_run(cursor, run_id, "failed", imported, str(exc))
            connection.commit()
            raise
    finally:
        connection.close()

    print(f"Zigbee2MQTT-Import abgeschlossen: {imported}/{len(devices)} Geräte verarbeitet.")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import Zigbee2MQTT data into SmartGuide.")
    parser.add_argument(
        "--source",
        choices=["sample", "zhc"],
        default="sample",
        help="Importquelle: lokale Sample/JSON-Datei oder lokales zigbee-herdsman-converters Repository.",
    )
    parser.add_argument(
        "--zhc-path",
        help="Pfad zu einem lokal geklonten und gebauten zigbee-herdsman-converters Repository.",
    )
    parser.add_argument(
        "input",
        nargs="?",
        default=DEFAULT_INPUT,
        help=f"Pfad zur lokalen JSON-Datei fuer --source sample (Standard: {DEFAULT_INPUT})",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        return run_import(args)
    except SystemExit:
        raise
    except Exception as exc:
        print(f"Import fehlgeschlagen: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
