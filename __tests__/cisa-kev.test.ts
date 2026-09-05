import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CisaKevSourceAdapter, type CisaKevResponse } from "@/lib/sources/cisa-kev";
import type { CVE } from "@/types/cve";

describe("CisaKevSourceAdapter", () => {
  let adapter: CisaKevSourceAdapter;

  const mockCisaFeed: CisaKevResponse = {
    title: "CISA Known Exploited Vulnerabilities Catalog",
    catalogVersion: "2024.03.01",
    dateReleased: "2024-03-01T00:00:00.000Z",
    count: 2,
    vulnerabilities: [
      {
        cveID: "CVE-2021-44228",
        vendorProject: "Apache",
        product: "Log4j",
        vulnerabilityName: "Apache Log4j Remote Code Execution Vulnerability",
        dateAdded: "2021-12-10",
        shortDescription: "Apache Log4j2 contains an RCE vulnerability.",
        requiredAction: "Apply updates per vendor instructions.",
        dueDate: "2021-12-24",
        notes: "https://logging.apache.org/log4j/2.x/security.html",
      },
      {
        cveID: "CVE-2023-22515",
        vendorProject: "Atlassian",
        product: "Confluence Data Center and Server",
        vulnerabilityName: "Atlassian Confluence Broken Access Control Vulnerability",
        dateAdded: "2023-10-05",
        shortDescription: "Atlassian Confluence contains a broken access control vulnerability.",
        requiredAction: "Apply immediate mitigations per vendor.",
        dueDate: "2023-10-26",
      },
    ],
  };

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
    affected: [{ vendor: "Apache", product: "Log4j", versions: ["2.14.1"] }],
    references: [{ url: "https://logging.apache.org/log4j/2.x/security.html", source: "Apache" }],
    category: "web-application",
    hasPoc: false,
    sources: ["NVD"],
  };

  beforeEach(() => {
    CisaKevSourceAdapter.resetState();
    adapter = new CisaKevSourceAdapter({
      timeoutMs: 1000,
      rateLimit: { maxRequests: 50, windowMs: 1000 },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Listed CVE: correctly identifies CVE in KEV and returns dateAdded, dueDate, and requiredAction", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockCisaFeed,
    } as Response);

    const status = await adapter.fetchById("CVE-2021-44228");

    expect(status).not.toBeNull();
    expect(status?.isKev).toBe(true);
    expect(status?.dateAdded).toBe("2021-12-10");
    expect(status?.dueDate).toBe("2021-12-24");
    expect(status?.requiredAction).toBe("Apply updates per vendor instructions.");
    expect(status?.notes).toBe("https://logging.apache.org/log4j/2.x/security.html");
  });

  it("2. Unlisted CVE: returns isKev: false when CVE is not in the CISA KEV catalog", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockCisaFeed,
    } as Response);

    const status = await adapter.fetchById("CVE-2099-00001");

    expect(status).not.toBeNull();
    expect(status?.isKev).toBe(false);
  });

  it("3. Invalid CVE ID: ignores invalid format without issuing network request", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    const status = await adapter.fetchById("MALFORMED-CVE");

    expect(status).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("4. In-memory caching: reuses catalog without duplicate network requests", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockCisaFeed,
    } as Response);

    // Call fetchById 3 times for different CVEs
    const res1 = await adapter.fetchById("CVE-2021-44228");
    const res2 = await adapter.fetchById("CVE-2023-22515");
    const res3 = await adapter.fetchById("CVE-2024-99999");

    expect(res1?.isKev).toBe(true);
    expect(res2?.isKev).toBe(true);
    expect(res3?.isKev).toBe(false);

    // Only one HTTP fetch should have occurred
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("5. Resilience: handles network/server errors gracefully", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("CISA CDN unreachable"));

    const status = await adapter.fetchById("CVE-2021-44228");
    expect(status).toEqual({ isKev: false });
  });

  it("6. Enrichment integrity: preserves original CVSS and NVD data without modification", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockCisaFeed,
    } as Response);

    const enriched = await adapter.enrichCve(mockCve);

    expect(enriched.cisaKev?.isKev).toBe(true);
    expect(enriched.cisaKev?.dateAdded).toBe("2021-12-10");
    expect(enriched.sources).toContain("CISA_KEV");
    expect(enriched.sources).toContain("NVD");

    // CVSS and NVD fields must remain completely intact
    expect(enriched.cvss.baseScore).toBe(mockCve.cvss.baseScore);
    expect(enriched.cvss.severity).toBe(mockCve.cvss.severity);
    expect(enriched.cvss.vectorString).toBe(mockCve.cvss.vectorString);
    expect(enriched.cvss.scope).toBe(mockCve.cvss.scope);
    expect(enriched.descriptionEn).toBe(mockCve.descriptionEn);
    expect(enriched.descriptionId).toBe(mockCve.descriptionId);
    expect(enriched.affected).toEqual(mockCve.affected);
  });
});
