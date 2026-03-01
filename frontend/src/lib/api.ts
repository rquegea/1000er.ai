import type {
  AnalysisUploadResponse,
  Analysis,
  AnalysisListResponse,
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
} from "@/types";
import { createBrowserClient } from "@/lib/supabase";

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
  const formData = new FormData();
  formData.append("file", file);

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
