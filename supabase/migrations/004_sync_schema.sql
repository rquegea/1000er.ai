-- 004_sync_schema.sql
-- Sync database schema with application code

-- ============================================================
-- STORES — add geolocation and contact_name
-- ============================================================
ALTER TABLE stores ADD COLUMN IF NOT EXISTS latitude      DOUBLE PRECISION;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS longitude     DOUBLE PRECISION;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS contact_name  TEXT;

-- ============================================================
-- VISIT_PHOTOS — photo storage per visit with AI analysis link
-- ============================================================
CREATE TABLE IF NOT EXISTS visit_photos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    visit_id      UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    category      TEXT NOT NULL CHECK (category IN ('shelf', 'promotion', 'activity')),
    image_url     TEXT NOT NULL,
    analysis_id   UUID REFERENCES analyses(id) ON DELETE SET NULL,
    uploaded_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_photos_tenant_id   ON visit_photos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visit_photos_visit_id    ON visit_photos(visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_photos_analysis_id ON visit_photos(analysis_id);

ALTER TABLE visit_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY visit_photos_tenant_isolation ON visit_photos
    USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- ============================================================
-- ANALYSES — add consolidation flag
-- ============================================================
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS is_consolidated BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- VISITS — allow 'missed' status
-- ============================================================
ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_status_check;
ALTER TABLE visits ADD CONSTRAINT visits_status_check
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'missed'));
