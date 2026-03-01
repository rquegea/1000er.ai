-- 002_gpv_schema.sql
-- GPV schema: visits, products, product_photos + alterations to users & stores

-- ============================================================
-- ALTER USERS — expand role CHECK, add GPV fields
-- ============================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'key_account', 'gpv'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone      TEXT;

-- ============================================================
-- ALTER STORES — add responsible user, key account, contacts
-- ============================================================
ALTER TABLE stores ADD COLUMN IF NOT EXISTS responsible_user_id     UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS key_account_id          UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS phone_section_manager   TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS email_section_manager   TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS phone_sector_manager    TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS email_sector_manager    TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS phone_director          TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS email_director          TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS region                  TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS area                    TEXT;

CREATE INDEX IF NOT EXISTS idx_stores_responsible_user_id ON stores(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_stores_key_account_id      ON stores(key_account_id);

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
    ended_at         TIMESTAMPTZ,
    status           TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    notes            TEXT,
    duration_minutes INTEGER,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visits_tenant_id ON visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visits_store_id  ON visits(store_id);
CREATE INDEX IF NOT EXISTS idx_visits_user_id   ON visits(user_id);
CREATE INDEX IF NOT EXISTS idx_visits_status    ON visits(status);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    brand      TEXT,
    ean        TEXT,
    category   TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, ean)
);

CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);

-- ============================================================
-- PRODUCT_PHOTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS product_photos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    visit_id    UUID REFERENCES visits(id) ON DELETE SET NULL,
    store_id    UUID REFERENCES stores(id) ON DELETE SET NULL,
    image_url   TEXT NOT NULL,
    type        TEXT,
    analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_photos_tenant_id   ON product_photos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_photos_visit_id    ON product_photos(visit_id);
CREATE INDEX IF NOT EXISTS idx_product_photos_store_id    ON product_photos(store_id);
CREATE INDEX IF NOT EXISTS idx_product_photos_analysis_id ON product_photos(analysis_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- visits
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY visits_tenant_isolation ON visits
    USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_tenant_isolation ON products
    USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- product_photos
ALTER TABLE product_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_photos_tenant_isolation ON product_photos
    USING (tenant_id::text = auth.jwt() ->> 'tenant_id');
