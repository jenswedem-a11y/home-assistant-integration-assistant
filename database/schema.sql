-- SmartGuide device catalog (SQLite).
-- JSON values are stored as TEXT, timestamps as ISO-8601 TEXT (UTC).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS import_runs (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TEXT,
    items_seen INTEGER NOT NULL DEFAULT 0,
    items_imported INTEGER NOT NULL DEFAULT 0,
    error_message TEXT
);

-- Canonical product family or normalized device record. Concrete variants and
-- technical identifiers are stored separately.
CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY,
    canonical_vendor TEXT NOT NULL,
    canonical_model TEXT NOT NULL,
    display_name TEXT,
    protocol TEXT,
    device_type TEXT,
    description TEXT,
    confidence REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT devices_vendor_model_unique UNIQUE (canonical_vendor, canonical_model)
);

-- Concrete device variants belonging to a canonical product family.
CREATE TABLE IF NOT EXISTS device_variants (
    id INTEGER PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    variant_name TEXT,
    model_number TEXT,
    hardware_version TEXT,
    firmware_version TEXT,
    region TEXT,
    notes TEXT,
    confidence REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Technical identifiers observed for a concrete device variant.
-- identifier_type: model_number, zigbee_model, manufacturer_name, hardware_version,
-- firmware_version, ean, gtin, sku, product_code, fcc_id, white_label.
CREATE TABLE IF NOT EXISTS device_identifiers (
    id INTEGER PRIMARY KEY,
    variant_id INTEGER NOT NULL REFERENCES device_variants(id) ON DELETE CASCADE,
    identifier_type TEXT NOT NULL,
    identifier_value TEXT NOT NULL,
    source TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT device_identifiers_unique UNIQUE (variant_id, identifier_type, identifier_value, source)
);

CREATE TABLE IF NOT EXISTS device_sources (
    id INTEGER PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    source_vendor TEXT,
    source_model TEXT,
    source_url TEXT,
    raw_data TEXT,
    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_capabilities (
    id INTEGER PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    capability TEXT NOT NULL,
    value TEXT,
    source TEXT
);

CREATE TABLE IF NOT EXISTS device_compatibility (
    id INTEGER PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    supported INTEGER NOT NULL,
    notes TEXT,
    source TEXT
);

CREATE INDEX IF NOT EXISTS idx_import_runs_source ON import_runs(source);
CREATE INDEX IF NOT EXISTS idx_devices_protocol ON devices(protocol);
CREATE INDEX IF NOT EXISTS idx_devices_device_type ON devices(device_type);
CREATE INDEX IF NOT EXISTS idx_device_variants_device_id ON device_variants(device_id);
CREATE INDEX IF NOT EXISTS idx_device_variants_model_number ON device_variants(model_number);
CREATE INDEX IF NOT EXISTS idx_device_identifiers_variant_id ON device_identifiers(variant_id);
CREATE INDEX IF NOT EXISTS idx_device_identifiers_type_value ON device_identifiers(identifier_type, identifier_value);
CREATE INDEX IF NOT EXISTS idx_device_sources_device_id ON device_sources(device_id);
CREATE INDEX IF NOT EXISTS idx_device_sources_source ON device_sources(source);
CREATE INDEX IF NOT EXISTS idx_device_capabilities_device_id ON device_capabilities(device_id);
CREATE INDEX IF NOT EXISTS idx_device_compatibility_device_id ON device_compatibility(device_id);
CREATE INDEX IF NOT EXISTS idx_device_compatibility_platform ON device_compatibility(platform);

-- These unique indexes make manual imports idempotent. SQLite treats NULLs as
-- distinct, so optional fields are COALESCEd to get "NULLS NOT DISTINCT"
-- semantics. Upserts must use the exact same expressions as conflict target.
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_variants_unique
    ON device_variants(device_id, COALESCE(variant_name, ''), COALESCE(model_number, ''));

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_sources_unique
    ON device_sources(device_id, source, COALESCE(source_model, ''));

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_capabilities_unique
    ON device_capabilities(device_id, capability, COALESCE(source, ''));

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_compatibility_unique
    ON device_compatibility(device_id, platform, COALESCE(source, ''));
