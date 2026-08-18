CREATE TABLE IF NOT EXISTS import_runs (
    id BIGSERIAL PRIMARY KEY,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    items_seen INTEGER NOT NULL DEFAULT 0,
    items_imported INTEGER NOT NULL DEFAULT 0,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS devices (
    id BIGSERIAL PRIMARY KEY,
    canonical_vendor TEXT NOT NULL,
    canonical_model TEXT NOT NULL,
    display_name TEXT,
    protocol TEXT,
    device_type TEXT,
    description TEXT,
    confidence NUMERIC(5, 4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT devices_vendor_model_unique UNIQUE (canonical_vendor, canonical_model)
);

COMMENT ON TABLE devices IS 'Canonical product family or normalized device record. Concrete variants and technical identifiers are stored separately.';
COMMENT ON COLUMN devices.canonical_vendor IS 'Normalized vendor name for the product family.';
COMMENT ON COLUMN devices.canonical_model IS 'Normalized model or product-family name, not necessarily a physical model number.';

CREATE TABLE IF NOT EXISTS device_variants (
    id BIGSERIAL PRIMARY KEY,
    device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    variant_name TEXT,
    model_number TEXT,
    hardware_version TEXT,
    firmware_version TEXT,
    region TEXT,
    notes TEXT,
    confidence NUMERIC(5, 4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE device_variants IS 'Concrete device variants belonging to a canonical product family.';

CREATE TABLE IF NOT EXISTS device_identifiers (
    id BIGSERIAL PRIMARY KEY,
    variant_id BIGINT NOT NULL REFERENCES device_variants(id) ON DELETE CASCADE,
    identifier_type TEXT NOT NULL,
    identifier_value TEXT NOT NULL,
    source TEXT NOT NULL,
    confidence NUMERIC(5, 4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT device_identifiers_unique UNIQUE (variant_id, identifier_type, identifier_value, source)
);

COMMENT ON TABLE device_identifiers IS 'Technical identifiers observed for a concrete device variant.';
COMMENT ON COLUMN device_identifiers.identifier_type IS 'Allowed values: model_number, zigbee_model, manufacturer_name, hardware_version, firmware_version, ean, gtin, sku, product_code, fcc_id, white_label.';

CREATE TABLE IF NOT EXISTS device_sources (
    id BIGSERIAL PRIMARY KEY,
    device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    source_vendor TEXT,
    source_model TEXT,
    source_url TEXT,
    raw_data JSONB,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_capabilities (
    id BIGSERIAL PRIMARY KEY,
    device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    capability TEXT NOT NULL,
    value JSONB,
    source TEXT
);

CREATE TABLE IF NOT EXISTS device_compatibility (
    id BIGSERIAL PRIMARY KEY,
    device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    supported BOOLEAN NOT NULL,
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

-- These unique indexes make manual imports idempotent. NULLS NOT DISTINCT prevents
-- repeated rows when optional source fields are still unknown in early imports.
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_variants_unique
    ON device_variants(device_id, variant_name, model_number) NULLS NOT DISTINCT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_sources_unique
    ON device_sources(device_id, source, source_model) NULLS NOT DISTINCT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_capabilities_unique
    ON device_capabilities(device_id, capability, source) NULLS NOT DISTINCT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_compatibility_unique
    ON device_compatibility(device_id, platform, source) NULLS NOT DISTINCT;
