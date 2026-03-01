-- 002_gpv_core.sql
-- GPV (Gestion de Punto de Venta) core tables and alterations

-- ============================================================
-- CHAINS
-- ============================================================
CREATE TABLE IF NOT EXISTS chains (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    logo_url    TEXT,
    website     TEXT,
    country     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chains_tenant_id ON chains(tenant_id);

-- ============================================================
-- BRANDS
-- ============================================================
CREATE TABLE IF NOT EXISTS brands (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    logo_url    TEXT,
    is_own      BOOLEAN NOT NULL DEFAULT false,
    category    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brands_tenant_id ON brands(tenant_id);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    brand_id     UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    sku          TEXT,
    ean          TEXT,
    category     TEXT,
    subcategory  TEXT,
    image_url    TEXT,
    base_price   NUMERIC(10, 2),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, ean)
);

CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);

-- ============================================================
-- ALTER USERS — expand role CHECK, add GPV fields
-- ============================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'analyst', 'key_account', 'gpv_manager', 'supervisor'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
-- ALTER STORES — add chain_id, responsible user, contact fields
-- ============================================================
ALTER TABLE stores ADD COLUMN IF NOT EXISTS chain_id UUID REFERENCES chains(id) ON DELETE SET NULL;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS user_responsible_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS jefe_seccion_nombre TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS jefe_seccion_telefono TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS jefe_sector_nombre TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS jefe_sector_telefono TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS director_nombre TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS director_telefono TEXT;

CREATE INDEX IF NOT EXISTS idx_stores_chain_id ON stores(chain_id);
CREATE INDEX IF NOT EXISTS idx_stores_user_responsible_id ON stores(user_responsible_id);

-- ============================================================
-- VISITS
-- ============================================================
CREATE TABLE IF NOT EXISTS visits (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id         UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheduled_at     TIMESTAMPTZ,
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    duration_minutes INTEGER,
    status           TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visits_tenant_id ON visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visits_store_id ON visits(store_id);
CREATE INDEX IF NOT EXISTS idx_visits_user_id ON visits(user_id);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);

-- ============================================================
-- ALTER SHELF_UPLOADS — add visit_id
-- ============================================================
ALTER TABLE shelf_uploads ADD COLUMN IF NOT EXISTS visit_id UUID REFERENCES visits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shelf_uploads_visit_id ON shelf_uploads(visit_id);

-- ============================================================
-- ALTER DETECTED_PRODUCTS — add product_id, store_id
-- ============================================================
ALTER TABLE detected_products ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE detected_products ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_detected_products_product_id ON detected_products(product_id);
CREATE INDEX IF NOT EXISTS idx_detected_products_store_id ON detected_products(store_id);

-- ============================================================
-- SHELVES_DATA
-- ============================================================
CREATE TABLE IF NOT EXISTS shelves_data (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    analysis_id       UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    store_id          UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    visit_id          UUID REFERENCES visits(id) ON DELETE SET NULL,
    total_facings     INTEGER NOT NULL DEFAULT 0,
    own_brand_facings INTEGER NOT NULL DEFAULT 0,
    brand_share_pct   NUMERIC(5, 2),
    oos_count         INTEGER NOT NULL DEFAULT 0,
    oos_rate_pct      NUMERIC(5, 2),
    avg_confidence    REAL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shelves_data_tenant_id ON shelves_data(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shelves_data_analysis_id ON shelves_data(analysis_id);
CREATE INDEX IF NOT EXISTS idx_shelves_data_visit_id ON shelves_data(visit_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelves_data ENABLE ROW LEVEL SECURITY;
