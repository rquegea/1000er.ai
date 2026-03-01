import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAnalyses } from "../api";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("listAnalyses", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("parses a successful response correctly", async () => {
    const mockResponse = {
      data: [
        {
          id: "abc-123",
          tenant_id: "t1",
          shelf_upload_id: "su1",
          status: "completed",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await listAnalyses();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/analyses/?limit=20&offset=0"
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("abc-123");
    expect(result.total).toBe(1);
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(listAnalyses()).rejects.toThrow("Failed to fetch analyses (500)");
  });
});
