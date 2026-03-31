-- Scans: shelf scanning with multi-photo stitching support

CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  visit_id UUID REFERENCES visits(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  status TEXT NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading','stitching','analyzing','completed','failed')),
  photo_count INTEGER NOT NULL DEFAULT 0,
  panorama_url TEXT,
  analysis_id UUID,
  metadata JSONB DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE scan_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  photo_index INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(scan_id, photo_index)
);

-- Indices
CREATE INDEX idx_scans_tenant ON scans(tenant_id);
CREATE INDEX idx_scans_visit ON scans(visit_id);
CREATE INDEX idx_scans_store ON scans(store_id);
CREATE INDEX idx_scan_photos_scan ON scan_photos(scan_id);
CREATE INDEX idx_scan_photos_tenant ON scan_photos(tenant_id);

-- RLS
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'scans' AND policyname = 'scans_tenant_isolation'
    ) THEN
        CREATE POLICY scans_tenant_isolation ON scans
            USING (tenant_id::text = auth.jwt() ->> 'tenant_id');
    END IF;
END
$$;

ALTER TABLE scan_photos ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'scan_photos' AND policyname = 'scan_photos_tenant_isolation'
    ) THEN
        CREATE POLICY scan_photos_tenant_isolation ON scan_photos
            USING (tenant_id::text = auth.jwt() ->> 'tenant_id');
    END IF;
END
$$;
