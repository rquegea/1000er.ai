-- Add analysis_status to visit_photos for async analysis tracking
ALTER TABLE visit_photos ADD COLUMN IF NOT EXISTS analysis_status TEXT
    CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'failed'));
