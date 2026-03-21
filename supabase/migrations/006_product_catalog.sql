-- Extend products table with catalog fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_own BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Add RLS if not present
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_tenant_isolation'
    ) THEN
        CREATE POLICY products_tenant_isolation ON products
            USING (tenant_id::text = auth.jwt() ->> 'tenant_id');
    END IF;
END
$$;

-- Link detected_products to catalog
ALTER TABLE detected_products ADD COLUMN IF NOT EXISTS catalog_product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE detected_products ADD COLUMN IF NOT EXISTS is_own BOOLEAN;
