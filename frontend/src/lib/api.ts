import type {
  AnalysisUploadResponse,
  Analysis,
  AnalysisListResponse,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function uploadAndAnalyze(
  file: File
): Promise<AnalysisUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/v1/analyses/upload`, {
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
  const res = await fetch(`${API_URL}/api/v1/analyses/${id}`);

  if (!res.ok) {
    throw new Error(`Analysis not found (${res.status})`);
  }

  return res.json();
}

export async function listAnalyses(
  limit = 20,
  offset = 0
): Promise<AnalysisListResponse> {
  const res = await fetch(
    `${API_URL}/api/v1/analyses/?limit=${limit}&offset=${offset}`
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch analyses (${res.status})`);
  }

  return res.json();
}
