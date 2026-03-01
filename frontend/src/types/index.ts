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

// ── Users ──────────────────────────────────────────────────

export type UserRole = "admin" | "key_account" | "gpv";

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
}

export interface UserListResponse {
  data: User[];
  total: number;
  limit: number;
  offset: number;
}

export interface UserCreatePayload {
  email: string;
  password: string;
  role: UserRole;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export interface UserUpdatePayload {
  email?: string;
  role?: UserRole;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

// ── Visits ─────────────────────────────────────────────────

export type VisitStatus = "scheduled" | "in_progress" | "completed" | "cancelled" | "missed";

export interface Visit {
  id: string;
  tenant_id: string;
  store_id: string;
  user_id: string;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  status: VisitStatus;
  notes: string | null;
  created_at: string;
}

export interface VisitListResponse {
  data: Visit[];
  total: number;
  limit: number;
  offset: number;
}

export interface VisitCreatePayload {
  store_id: string;
  user_id?: string;
  scheduled_at?: string;
  notes?: string;
}

export interface VisitUpdatePayload {
  store_id?: string;
  scheduled_at?: string;
  notes?: string;
  status?: VisitStatus;
}

export interface Store {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  chain: string | null;
  responsible_user_id: string | null;
  key_account_id: string | null;
  contact_name: string | null;
  phone_section_manager: string | null;
  email_section_manager: string | null;
  phone_sector_manager: string | null;
  email_sector_manager: string | null;
  region: string | null;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface StoreListResponse {
  data: Store[];
  total: number;
  limit: number;
  offset: number;
}

export interface StoreCreatePayload {
  name: string;
  address?: string;
  chain?: string;
  responsible_user_id?: string;
  key_account_id?: string;
  contact_name?: string;
  phone_section_manager?: string;
  email_section_manager?: string;
  phone_sector_manager?: string;
  email_sector_manager?: string;
  region?: string;
  area?: string;
  latitude?: number;
  longitude?: number;
}

export interface StoreUpdatePayload {
  name?: string;
  address?: string;
  chain?: string;
  responsible_user_id?: string;
  key_account_id?: string;
  contact_name?: string;
  phone_section_manager?: string;
  email_section_manager?: string;
  phone_sector_manager?: string;
  email_sector_manager?: string;
  region?: string;
  area?: string;
  latitude?: number | null;
  longitude?: number | null;
}
