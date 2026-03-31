import type {
  AnalysisUploadResponse,
  Analysis,
  AnalysisListResponse,
  AnalyticsSummary,
  User,
  UserListResponse,
  UserCreatePayload,
  UserUpdatePayload,
  Store,
  StoreListResponse,
  StoreCreatePayload,
  StoreUpdatePayload,
  Visit,
  VisitListResponse,
  VisitCreatePayload,
  VisitUpdatePayload,
  VisitPhoto,
  VisitPhotoListResponse,
  VisitSummary,
  PhotoCategory,
  CatalogProduct,
  CatalogProductListResponse,
  CatalogProductCreatePayload,
  CatalogProductUpdatePayload,
  CatalogSuggestion,
  Scan,
  ScanDetail,
  ScanListResponse,
  ScanCreatePayload,
  ScanPhoto,
} from "@/types";
import { createBrowserClient } from "@/lib/supabase";
import { compressImage } from "@/lib/imageUtils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const supabase = createBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(url, { ...options, headers });
}

// ── Analyses ──────────────────────────────────────────────

export async function uploadAndAnalyze(
  file: File
): Promise<AnalysisUploadResponse> {
  const compressed = await compressImage(file);
  const formData = new FormData();
  formData.append("file", compressed);

  const res = await authFetch(`${API_URL}/api/v1/analyses/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }

  return res.json();
}

export async function getAnalysis(id: string): Promise<Analysis> {
  const res = await authFetch(`${API_URL}/api/v1/analyses/${id}`);

  if (!res.ok) {
    throw new Error(`Analysis not found (${res.status})`);
  }

  return res.json();
}

export async function listAnalyses(
  limit = 20,
  offset = 0
): Promise<AnalysisListResponse> {
  const res = await authFetch(
    `${API_URL}/api/v1/analyses/?limit=${limit}&offset=${offset}`
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch analyses (${res.status})`);
  }

  return res.json();
}

export async function getAnalyticsSummary(params?: {
  days?: number;
  chain?: string;
  store_id?: string;
}): Promise<AnalyticsSummary> {
  const searchParams = new URLSearchParams();
  if (params?.days) searchParams.set("days", String(params.days));
  if (params?.chain) searchParams.set("chain", params.chain);
  if (params?.store_id) searchParams.set("store_id", params.store_id);
  const qs = searchParams.toString();
  const res = await authFetch(
    `${API_URL}/api/v1/analytics/summary${qs ? `?${qs}` : ""}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch analytics (${res.status})`);
  }
  return res.json();
}

export async function retryAnalysis(id: string): Promise<Analysis> {
  const res = await authFetch(`${API_URL}/api/v1/analyses/${id}/retry`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Retry failed" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function exportAnalysisCsv(id: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/analyses/${id}/export`);
  if (!res.ok) {
    throw new Error(`Failed to export analysis (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analisis_${id.slice(0, 8)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportVisitCsv(visitId: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/visits/${visitId}/export`);
  if (!res.ok) {
    throw new Error(`Failed to export visit (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `visita_${visitId.slice(0, 8)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Users ─────────────────────────────────────────────────

export async function getMe(): Promise<User> {
  const res = await authFetch(`${API_URL}/api/v1/users/me`);
  if (!res.ok) {
    throw new Error(`Failed to fetch current user (${res.status})`);
  }
  return res.json();
}

export async function listUsers(
  limit = 50,
  offset = 0
): Promise<UserListResponse> {
  const res = await authFetch(
    `${API_URL}/api/v1/users/?limit=${limit}&offset=${offset}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch users (${res.status})`);
  }
  return res.json();
}

export async function createUser(payload: UserCreatePayload): Promise<User> {
  const res = await authFetch(`${API_URL}/api/v1/users/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to create user" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function updateUser(
  userId: string,
  payload: UserUpdatePayload
): Promise<User> {
  const res = await authFetch(`${API_URL}/api/v1/users/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to update user" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function deleteUser(userId: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/users/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to delete user" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
}

// ── Stores ────────────────────────────────────────────────

export async function listStores(
  limit = 50,
  offset = 0
): Promise<StoreListResponse> {
  const res = await authFetch(
    `${API_URL}/api/v1/stores/?limit=${limit}&offset=${offset}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch stores (${res.status})`);
  }
  return res.json();
}

export async function getStore(storeId: string): Promise<Store> {
  const res = await authFetch(`${API_URL}/api/v1/stores/${storeId}`);
  if (!res.ok) {
    throw new Error(`Store not found (${res.status})`);
  }
  return res.json();
}

export async function createStore(payload: StoreCreatePayload): Promise<Store> {
  const res = await authFetch(`${API_URL}/api/v1/stores/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to create store" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function updateStore(
  storeId: string,
  payload: StoreUpdatePayload
): Promise<Store> {
  const res = await authFetch(`${API_URL}/api/v1/stores/${storeId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to update store" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function deleteStore(storeId: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/stores/${storeId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to delete store" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
}

// ── Visits ────────────────────────────────────────────────

export async function getVisit(visitId: string): Promise<Visit> {
  const res = await authFetch(`${API_URL}/api/v1/visits/${visitId}`);
  if (!res.ok) {
    throw new Error(`Visit not found (${res.status})`);
  }
  return res.json();
}

export async function listVisits(
  limit = 100,
  offset = 0
): Promise<VisitListResponse> {
  const res = await authFetch(
    `${API_URL}/api/v1/visits/?limit=${limit}&offset=${offset}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch visits (${res.status})`);
  }
  return res.json();
}

export async function createVisit(payload: VisitCreatePayload): Promise<Visit> {
  const res = await authFetch(`${API_URL}/api/v1/visits/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to create visit" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function updateVisit(
  visitId: string,
  payload: VisitUpdatePayload
): Promise<Visit> {
  const res = await authFetch(`${API_URL}/api/v1/visits/${visitId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to update visit" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function startVisit(visitId: string): Promise<Visit> {
  const res = await authFetch(`${API_URL}/api/v1/visits/${visitId}/start`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to start visit" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function endVisit(visitId: string): Promise<Visit> {
  const res = await authFetch(`${API_URL}/api/v1/visits/${visitId}/end`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to end visit" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function deleteVisit(visitId: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/visits/${visitId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to delete visit" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
}

// ── Visit Photos ─────────────────────────────────────────

export async function uploadVisitPhoto(
  visitId: string,
  file: File,
  category: PhotoCategory,
  notes?: string
): Promise<VisitPhoto> {
  const compressed = await compressImage(file);
  const formData = new FormData();
  formData.append("file", compressed);
  formData.append("category", category);
  if (notes) formData.append("notes", notes);

  const res = await authFetch(
    `${API_URL}/api/v1/visits/${visitId}/photos`,
    { method: "POST", body: formData }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to upload photo" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function listVisitPhotos(
  visitId: string,
  category?: PhotoCategory
): Promise<VisitPhotoListResponse> {
  const params = category ? `?category=${category}` : "";
  const res = await authFetch(
    `${API_URL}/api/v1/visits/${visitId}/photos${params}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch visit photos (${res.status})`);
  }
  return res.json();
}

export async function deleteVisitPhoto(
  visitId: string,
  photoId: string
): Promise<void> {
  const res = await authFetch(
    `${API_URL}/api/v1/visits/${visitId}/photos/${photoId}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to delete photo" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
}

export async function consolidateVisitAnalyses(
  visitId: string
): Promise<Analysis> {
  const res = await authFetch(
    `${API_URL}/api/v1/visits/${visitId}/consolidate`,
    { method: "POST" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Consolidation failed" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function getVisitSummary(visitId: string): Promise<VisitSummary> {
  const res = await authFetch(
    `${API_URL}/api/v1/visits/${visitId}/summary`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch visit summary (${res.status})`);
  }
  return res.json();
}

export async function getPhotoAnalysisStatus(
  visitId: string,
  photoId: string
): Promise<{ analysis_status: string | null; analysis_id: string | null }> {
  const res = await authFetch(
    `${API_URL}/api/v1/visits/${visitId}/photos/${photoId}/status`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch photo status (${res.status})`);
  }
  return res.json();
}

// ── Catalog ──────────────────────────────────────────────

export async function getCatalogSuggestions(): Promise<CatalogSuggestion[]> {
  const res = await authFetch(`${API_URL}/api/v1/catalog/suggestions`);
  if (!res.ok) {
    throw new Error(`Failed to fetch suggestions (${res.status})`);
  }
  return res.json();
}

export async function listCatalogProducts(params?: {
  limit?: number;
  offset?: number;
  brand?: string;
  category?: string;
  is_own?: boolean;
  q?: string;
}): Promise<CatalogProductListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  if (params?.brand) searchParams.set("brand", params.brand);
  if (params?.category) searchParams.set("category", params.category);
  if (params?.is_own !== undefined) searchParams.set("is_own", String(params.is_own));
  if (params?.q) searchParams.set("q", params.q);
  const qs = searchParams.toString();
  const res = await authFetch(
    `${API_URL}/api/v1/catalog/products${qs ? `?${qs}` : ""}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch catalog (${res.status})`);
  }
  return res.json();
}

export async function createCatalogProduct(
  payload: CatalogProductCreatePayload
): Promise<CatalogProduct> {
  const res = await authFetch(`${API_URL}/api/v1/catalog/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to create product" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function updateCatalogProduct(
  productId: string,
  payload: CatalogProductUpdatePayload
): Promise<CatalogProduct> {
  const res = await authFetch(`${API_URL}/api/v1/catalog/products/${productId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to update product" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function deleteCatalogProduct(productId: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/catalog/products/${productId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to delete product" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
}

export async function rematchCatalog(): Promise<{ matched: number; unmatched: number }> {
  const res = await authFetch(`${API_URL}/api/v1/catalog/rematch`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Rematch failed" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function bulkCreateCatalogProducts(
  products: CatalogProductCreatePayload[]
): Promise<CatalogProduct[]> {
  const res = await authFetch(`${API_URL}/api/v1/catalog/products/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(products),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Bulk create failed" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

// ── Scans ────────────────────────────────────────────────

export async function createScan(payload: ScanCreatePayload): Promise<Scan> {
  const res = await authFetch(`${API_URL}/api/v1/scans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to create scan" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function uploadScanPhoto(
  scanId: string,
  file: File,
  photoIndex: number
): Promise<ScanPhoto> {
  const compressed = await compressImage(file);
  const formData = new FormData();
  formData.append("file", compressed);
  formData.append("photo_index", String(photoIndex));

  const res = await authFetch(`${API_URL}/api/v1/scans/${scanId}/photos`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to upload scan photo" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function processScan(
  scanId: string
): Promise<{ scan_id: string; status: string; message: string }> {
  const res = await authFetch(`${API_URL}/api/v1/scans/${scanId}/process`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to process scan" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function getScan(scanId: string): Promise<ScanDetail> {
  const res = await authFetch(`${API_URL}/api/v1/scans/${scanId}`);
  if (!res.ok) {
    throw new Error(`Scan not found (${res.status})`);
  }
  return res.json();
}

export async function getScanPanorama(
  scanId: string
): Promise<{ panorama_url: string }> {
  const res = await authFetch(`${API_URL}/api/v1/scans/${scanId}/panorama`);
  if (!res.ok) {
    throw new Error(`Panorama not available (${res.status})`);
  }
  return res.json();
}

export async function listVisitScans(visitId: string): Promise<ScanListResponse> {
  const res = await authFetch(`${API_URL}/api/v1/visits/${visitId}/scans`);
  if (!res.ok) {
    throw new Error(`Failed to fetch scans (${res.status})`);
  }
  return res.json();
}
