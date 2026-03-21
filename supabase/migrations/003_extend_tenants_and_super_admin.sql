-- 003_extend_tenants_and_super_admin.sql
-- Extend tenants table with management fields and add super_admin role

-- ============================================================
-- EXTEND TENANTS
-- ============================================================
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url       TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contact_name   TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contact_email  TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contact_phone  TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS sector         TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address        TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_id         TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_users      INTEGER NOT NULL DEFAULT 50;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_stores     INTEGER NOT NULL DEFAULT 200;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active      BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS notes          TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT now();

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- UPDATE USERS ROLE CONSTRAINT
-- ============================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('super_admin', 'admin', 'analyst', 'gpv'));
