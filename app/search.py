import json
from typing import Any

from fastapi import APIRouter

from app.database import DatabaseConfigError, get_connection

router = APIRouter()


def error_response(message: str) -> dict[str, Any]:
    return {"ok": False, "error": message}


def query_all(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with get_connection() as connection:
        return [dict(row) for row in connection.execute(sql, params).fetchall()]


def query_one(sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(sql, params).fetchone()
        return dict(row) if row else None


def decode_json(rows: list[dict[str, Any]], column: str) -> list[dict[str, Any]]:
    for row in rows:
        if isinstance(row.get(column), str):
            try:
                row[column] = json.loads(row[column])
            except ValueError:
                pass
    return rows


def classify_match(row: dict[str, Any], query: str) -> str:
    needle = query.casefold()
    identifier_value = str(row.get("matched_identifier") or "").casefold()
    variant_model = str(row.get("matched_variant_model") or "").casefold()
    model = str(row.get("canonical_model") or "").casefold()
    vendor = str(row.get("canonical_vendor") or "").casefold()
    display_name = str(row.get("display_name") or "").casefold()

    if identifier_value and needle in identifier_value:
        return "identifier"
    if variant_model and needle in variant_model:
        return "model"
    if needle in model:
        return "model"
    if needle in vendor or needle in display_name:
        return "name"
    return "unknown"


def score_match(row: dict[str, Any], query: str, match_type: str) -> float:
    needle = query.casefold()
    exact_values = [
        row.get("matched_identifier"),
        row.get("matched_variant_model"),
        row.get("canonical_model"),
        row.get("display_name"),
        row.get("canonical_vendor"),
    ]
    if any(str(value or "").casefold() == needle for value in exact_values):
        return 1.0
    if match_type == "identifier":
        return 0.95
    if match_type == "model":
        return 0.9
    if match_type == "name":
        return 0.75
    return 0.5


@router.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@router.get("/devices/search")
def search_devices(q: str = "") -> dict[str, Any]:
    query = q.strip()
    if not query:
        return {"ok": True, "query": q, "items": []}

    pattern = f"%{query}%"
    try:
        rows = query_all(
            """
            SELECT
                d.id AS device_id,
                d.canonical_vendor,
                d.canonical_model,
                d.display_name,
                d.protocol,
                MIN(v.model_number) FILTER (
                    WHERE v.model_number LIKE ?
                ) AS matched_variant_model,
                MIN(i.identifier_value) FILTER (
                    WHERE i.identifier_value LIKE ?
                ) AS matched_identifier
            FROM devices d
            LEFT JOIN device_variants v ON v.device_id = d.id
            LEFT JOIN device_identifiers i ON i.variant_id = v.id
            WHERE
                d.canonical_vendor LIKE ?
                OR d.canonical_model LIKE ?
                OR d.display_name LIKE ?
                OR v.model_number LIKE ?
                OR i.identifier_value LIKE ?
            GROUP BY d.id, d.canonical_vendor, d.canonical_model, d.display_name, d.protocol
            ORDER BY d.canonical_vendor COLLATE NOCASE, d.canonical_model COLLATE NOCASE
            LIMIT 50
            """,
            (pattern, pattern, pattern, pattern, pattern, pattern, pattern),
        )
    except DatabaseConfigError as exc:
        return error_response(str(exc))

    items = []
    for row in rows:
        match_type = classify_match(row, query)
        items.append(
            {
                "device_id": row["device_id"],
                "vendor": row["canonical_vendor"],
                "model": row["canonical_model"],
                "display_name": row["display_name"],
                "protocol": row["protocol"],
                "match_type": match_type,
                "score": score_match(row, query, match_type),
            }
        )

    items.sort(key=lambda item: (-item["score"], item["vendor"] or "", item["model"] or ""))
    return {"ok": True, "query": q, "items": items}


@router.get("/devices/by-vendor")
def get_devices_by_vendor(vendor: str = "") -> dict[str, Any]:
    selected_vendor = vendor.strip()
    if not selected_vendor:
        return {"ok": True, "vendor": vendor, "items": []}

    try:
        items = query_all(
            """
            SELECT
                id AS device_id,
                canonical_vendor AS vendor,
                canonical_model AS model,
                display_name,
                protocol,
                device_type
            FROM devices
            WHERE canonical_vendor = ?
            ORDER BY canonical_model COLLATE NOCASE
            LIMIT 500
            """,
            (selected_vendor,),
        )
    except DatabaseConfigError as exc:
        return error_response(str(exc))

    return {"ok": True, "vendor": vendor, "items": items}


@router.get("/devices/{device_id}")
def get_device(device_id: int) -> dict[str, Any]:
    try:
        device = query_one("SELECT * FROM devices WHERE id = ?", (device_id,))
        if not device:
            return {"ok": False, "error": "Gerät nicht gefunden."}

        variants = query_all(
            "SELECT * FROM device_variants WHERE device_id = ? ORDER BY id",
            (device_id,),
        )
        variant_ids = [variant["id"] for variant in variants]

        identifiers: list[dict[str, Any]] = []
        if variant_ids:
            identifiers = query_all(
                f"""
                SELECT *
                FROM device_identifiers
                WHERE variant_id IN ({", ".join("?" * len(variant_ids))})
                ORDER BY identifier_type, identifier_value
                """,
                tuple(variant_ids),
            )

        capabilities = query_all(
            "SELECT * FROM device_capabilities WHERE device_id = ? ORDER BY capability",
            (device_id,),
        )
        decode_json(capabilities, "value")
        compatibility = query_all(
            "SELECT * FROM device_compatibility WHERE device_id = ? ORDER BY platform",
            (device_id,),
        )
        for row in compatibility:
            row["supported"] = bool(row["supported"])
        sources = decode_json(
            query_all(
                "SELECT * FROM device_sources WHERE device_id = ? ORDER BY source, source_model",
                (device_id,),
            ),
            "raw_data",
        )
    except DatabaseConfigError as exc:
        return error_response(str(exc))

    return {
        "ok": True,
        "device": device,
        "variants": variants,
        "identifiers": identifiers,
        "capabilities": capabilities,
        "compatibility": compatibility,
        "sources": sources,
    }


@router.get("/vendors")
def get_vendors() -> dict[str, Any]:
    try:
        items = query_all(
            """
            SELECT canonical_vendor AS vendor, COUNT(*) AS device_count
            FROM devices
            GROUP BY canonical_vendor
            ORDER BY device_count DESC, canonical_vendor COLLATE NOCASE
            """
        )
    except DatabaseConfigError as exc:
        return error_response(str(exc))

    return {"ok": True, "items": items}
