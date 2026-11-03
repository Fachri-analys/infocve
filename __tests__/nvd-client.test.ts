import { describe, expect, it, vi } from "vitest";
import { fetchNvd, getNvdErrorDetail, NvdApiError } from "@/lib/nvd-client";

describe("NVD error details", () => {
  it("reads the reason from NVD's message response header", () => {
    expect(getNvdErrorDetail(new Headers({ message: "resultsPerPage parameter cannot exceed 2000." }), null))
      .toBe("resultsPerPage parameter cannot exceed 2000.");
  });

  it("falls back to a JSON error message and bounds the detail length", () => {
    expect(getNvdErrorDetail(new Headers(), { message: "Invalid date range" })).toBe("Invalid date range");
    expect(getNvdErrorDetail(new Headers(), { message: "x".repeat(600) })).toHaveLength(500);
  });

  it("includes the HTTP status when the provider omits its message", () => {
    expect(new NvdApiError("invalid-request", 404).message).toContain("HTTP 404");
  });

  it("serializes Neon Date values as ISO 8601 in NVD query parameters", async () => {
    let requestedUrl = "";
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ totalResults: 0, vulnerabilities: [] }), { status: 200 });
    }));

    const start = new Date("2026-07-06T10:04:30.946Z");
    const end = new Date("2026-11-03T10:04:30.946Z");
    try {
      await fetchNvd({
        pubStartDate: start as unknown as string,
        pubEndDate: end as unknown as string,
      }, { noStore: true });
      const query = new URL(requestedUrl).searchParams;
      expect(query.get("pubStartDate")).toBe(start.toISOString());
      expect(query.get("pubEndDate")).toBe(end.toISOString());
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
