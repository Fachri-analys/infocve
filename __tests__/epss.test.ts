import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EpssSourceAdapter } from "@/lib/sources/epss";
import type { CVE } from "@/types/cve";

describe("EpssSourceAdapter", () => {
  let adapter: EpssSourceAdapter;

  const mockCve: CVE = {
    id: "CVE-2021-44228",
    title: "Apache Log4j Remote Code Execution",
    year: 2021,
    descriptionEn: "Remote code execution vulnerability in Log4j.",
    descriptionId: "Kerentanan eksekusi kode jarak jauh pada Log4j.",
    publishedDate: "2021-12-10T10:00:00.000Z",
    lastModifiedDate: "2021-12-14T10:00:00.000Z",
    vendor: "Apache",
    product: "Log4j",
    cvss: {
      version: "3.1",
      baseScore: 10.0,
      severity: "CRITICAL",
      vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
      attackVector: "NETWORK",
      attackComplexity: "LOW",
      privilegesRequired: "NONE",
      userInteraction: "NONE",
      scope: "CHANGED",
      confidentialityImpact: "HIGH",
      integrityImpact: "HIGH",
      availabilityImpact: "HIGH",
    },
    cwe: [{ id: "CWE-502", name: "Deserialization of Untrusted Data" }],
    affected: [{ vendor: "Apache", product: "Log4j", versions: ["2.0-beta9", "2.14.1"] }],
    references: [{ url: "https://logging.apache.org/log4j/2.x/security.html", source: "Apache" }],
    category: "web-application",
    hasPoc: false,
    sources: ["NVD"],
  };

  beforeEach(() => {
    adapter = new EpssSourceAdapter({
      baseUrl: "https://api.first.org/data/v1/epss",
      timeoutMs: 1000,
      rateLimit: { maxRequests: 100, windowMs: 1000 },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Success: correctly fetches, validates, and normalizes EPSS score", async () => {
    const mockApiResponse = {
      status: "OK",
      "status-code": 200,
      version: "1.0",
      total: 1,
      data: [
        {
          cve: "CVE-2021-44228",
          epss: "0.97548",
          percentile: "0.99994",
          date: "2024-03-01",
        },
      ],
    };

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    } as Response);

    const result = await adapter.fetchById("CVE-2021-44228");

    expect(result).not.toBeNull();
    expect(result?.score).toBe(0.97548);
    expect(result?.percentile).toBe(0.99994);
    expect(result?.date).toBe("2024-03-01");
  });

  it("2. Missing data: returns null when data array is empty or CVE is absent", async () => {
    const mockEmptyResponse = {
      status: "OK",
      "status-code": 200,
      total: 0,
      data: [],
    };

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockEmptyResponse,
    } as Response);

    const result = await adapter.fetchById("CVE-2099-00001");
    expect(result).toBeNull();
  });

  it("3. API error: gracefully handles HTTP 500 or network timeouts without crashing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);

    const result500 = await adapter.fetchById("CVE-2021-44228");
    expect(result500).toBeNull();

    // Network timeout / AbortError
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Connection timeout"));
    const resultTimeout = await adapter.fetchById("CVE-2021-44228");
    expect(resultTimeout).toBeNull();
  });

  it("4. Invalid response: rejects malformed JSON or non-numeric values without inventing scores", async () => {
    // Malformed structure missing required fields
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: "ERROR", message: "Invalid parameter" }),
    } as Response);

    const malformedResult = await adapter.fetchById("CVE-2021-44228");
    expect(malformedResult).toBeNull();

    // Non-numeric score string
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: "OK",
        "status-code": 200,
        data: [{ cve: "CVE-2021-44228", epss: "NOT_A_NUMBER", percentile: "0.5" }],
      }),
    } as Response);

    const nonNumericResult = await adapter.fetchById("CVE-2021-44228");
    expect(nonNumericResult).toBeNull();

    // Out-of-bounds probability (> 1.0)
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: "OK",
        "status-code": 200,
        data: [{ cve: "CVE-2021-44228", epss: "1.99", percentile: "0.5" }],
      }),
    } as Response);

    const outOfBoundsResult = await adapter.fetchById("CVE-2021-44228");
    expect(outOfBoundsResult).toBeNull();
  });

  it("5. Input validation: ignores invalid CVE ID format immediately", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    const result = await adapter.fetchById("INVALID-CVE-ID");
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("6. Enrichment integrity: enriches EPSS without altering CVSS or NVD data", async () => {
    vi.spyOn(adapter, "fetchById").mockResolvedValueOnce({
      score: 0.94,
      percentile: 0.98,
      date: "2024-03-01",
    });

    const enriched = await adapter.enrichCve(mockCve);

    // Assert EPSS was attached
    expect(enriched.epss).toEqual({
      score: 0.94,
      percentile: 0.98,
      date: "2024-03-01",
    });
    expect(enriched.sources).toContain("EPSS");
    expect(enriched.sources).toContain("NVD");

    // CRITICAL: Ensure CVSS metrics and NVD baseline data remain 100% identical
    expect(enriched.cvss.baseScore).toBe(mockCve.cvss.baseScore);
    expect(enriched.cvss.severity).toBe(mockCve.cvss.severity);
    expect(enriched.cvss.vectorString).toBe(mockCve.cvss.vectorString);
    expect(enriched.cvss.attackVector).toBe(mockCve.cvss.attackVector);
    expect(enriched.cvss.scope).toBe(mockCve.cvss.scope);
    expect(enriched.descriptionEn).toBe(mockCve.descriptionEn);
    expect(enriched.descriptionId).toBe(mockCve.descriptionId);
    expect(enriched.affected).toEqual(mockCve.affected);
  });

  it("7. Batch fetch: queries multiple CVEs and returns a mapped result", async () => {
    const mockBatchResponse = {
      status: "OK",
      "status-code": 200,
      total: 2,
      data: [
        { cve: "CVE-2021-44228", epss: "0.97548", percentile: "0.99994", date: "2024-03-01" },
        { cve: "CVE-2023-22515", epss: "0.85210", percentile: "0.95120", date: "2024-03-01" },
      ],
    };

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockBatchResponse,
    } as Response);

    const map = await adapter.fetchBatch(["CVE-2021-44228", "CVE-2023-22515"]);
    expect(map.size).toBe(2);
    expect(map.get("CVE-2021-44228")?.score).toBe(0.97548);
    expect(map.get("CVE-2023-22515")?.score).toBe(0.8521);
  });
});
