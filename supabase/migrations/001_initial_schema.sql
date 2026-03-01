-- 001_initial_schema.sql
-- Core tables for 1000er.ai retail shelf intelligence platform

-- ============================================================
-- TENANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    plan        TEXT NOT NULL DEFAULT 'free',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'analyst' CHECK (role IN ('admin', 'analyst')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- ============================================================
-- STORES
-- ============================================================
CREATE TABLE IF NOT EXISTS stores (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    address     TEXT,
    chain       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stores_tenant_id ON stores(tenant_id);

-- ============================================================
-- SHELF_UPLOADS
-- ============================================================
CREATE TABLE IF NOT EXISTS shelf_uploads (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    image_url    TEXT NOT NULL,
    uploaded_by  UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shelf_uploads_tenant_id ON shelf_uploads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shelf_uploads_store_id ON shelf_uploads(store_id);

-- ============================================================
-- ANALYSES
-- ============================================================
CREATE TABLE IF NOT EXISTS analyses (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    shelf_upload_id  UUID NOT NULL REFERENCES shelf_uploads(id) ON DELETE CASCADE,
    status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    raw_response     JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analyses_tenant_id ON analyses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analyses_shelf_upload_id ON analyses(shelf_upload_id);
CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);

-- ============================================================
-- DETECTED_PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS detected_products (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id   UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_name  TEXT NOT NULL,
    brand         TEXT,
    facings       INTEGER NOT NULL DEFAULT 0,
    price         NUMERIC(10, 2),
    position_x    REAL,
    position_y    REAL,
    is_oos        BOOLEAN NOT NULL DEFAULT false,
    confidence    REAL CHECK (confidence >= 0 AND confidence <= 1),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_detected_products_tenant_id ON detected_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_detected_products_analysis_id ON detected_products(analysis_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelf_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE detected_products ENABLE ROW LEVEL SECURITY;
