export interface DetectedProduct {
  id: string;
  product_name: string;
  brand: string | null;
  facings: number;
  price: number | null;
  position_x: number | null;
  position_y: number | null;
  is_oos: boolean;
  confidence: number | null;
}

export interface AnalysisSummary {
  total_products: number;
  total_facings: number;
  oos_count: number;
  avg_confidence: number;
}

export interface ShelfUpload {
  id: string;
  tenant_id: string;
  store_id: string;
  image_url: string;
  uploaded_by: string;
  created_at: string;
}

export interface Analysis {
  id: string;
  tenant_id: string;
  shelf_upload_id: string;
  status: string;
  created_at: string;
  summary?: AnalysisSummary | null;
  products?: DetectedProduct[];
}

export interface AnalysisUploadResponse {
  upload: ShelfUpload;
  analysis: Analysis;
}

export interface AnalysisListResponse {
  data: Analysis[];
  total: number;
  limit: number;
  offset: number;
}

export type VisitStatus = "scheduled" | "in_progress" | "completed" | "cancelled" | "missed";

export interface Visit {
  id: string;
  storeId: string;
  storeName: string;
  scheduledAt: string;
  status: VisitStatus;
  notes?: string;
}

export interface Store {
  id: string;
  name: string;
  address?: string;
  chain?: string;
}
