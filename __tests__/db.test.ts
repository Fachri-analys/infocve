import { describe, expect, it } from "vitest";
import { CveRepository } from "@/lib/db/cve-repository";
import type { CVE } from "@/types/cve";

describe("Database & CVE Repository", () => {
  const sampleCve: CVE = {
    id: "CVE-2024-9999",
    title: "SQL Injection in Test App",
    year: 2024,
    publishedDate: "2024-04-10T12:00:00.000Z",
    lastModifiedDate: "2024-04-11T12:00:00.000Z",
    descriptionEn: "SQL injection flaw in auth parameter.",
    descriptionId: "Celah SQL injection pada parameter auth.",
    vendor: "TestVendor",
    product: "TestProduct",
    category: "web-application",
    cvss: {
      version: "4.0",
      baseScore: 9.2,
      severity: "CRITICAL",
      vectorString: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
      attackVector: "NETWORK",
      attackComplexity: "LOW",
      attackRequirements: "NONE",
      privilegesRequired: "NONE",
      userInteraction: "NONE",
      scope: "NOT_DEFINED",
      confidentialityImpact: "HIGH",
      integrityImpact: "HIGH",
      availabilityImpact: "HIGH",
    },
    cwe: [{ id: "CWE-89", name: "SQL Injection" }],
    affected: [{ vendor: "TestVendor", product: "TestProduct", versions: ["1.0.0", "1.1.0"] }],
    references: [{ url: "https://example.com/advisory", source: "TestVendor", isExploit: true }],
    epss: { score: 0.85, percentile: 0.98 },
    cisaKev: { isKev: true, dateAdded: "2024-04-12", dueDate: "2024-05-01", requiredAction: "Apply patch." },
    hasPoc: true,
    sources: ["NVD", "CISA_KEV", "EPSS"],
  };

  it("inserts and retrieves a CVE record correctly", () => {
    CveRepository.upsert(sampleCve, "TEST_SUITE");
    const retrieved = CveRepository.getById("CVE-2024-9999");

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe("CVE-2024-9999");
    expect(retrieved?.title).toBe("SQL Injection in Test App");
    expect(retrieved?.cvss.baseScore).toBe(9.2);
    expect(retrieved?.cvss.severity).toBe("CRITICAL");
    expect(retrieved?.cvss.attackVector).toBe("NETWORK");
    expect(retrieved?.cvss.confidentialityImpact).toBe("HIGH");
    expect(retrieved?.cisaKev?.isKev).toBe(true);
    expect(retrieved?.epss?.score).toBe(0.85);
    expect(retrieved?.hasPoc).toBe(true);
    expect(retrieved?.cwe.length).toBe(1);
    expect(retrieved?.cwe[0]?.id).toBe("CWE-89");
  });

  it("searches and filters CVEs with pagination", () => {
    const searchRes = CveRepository.search({
      query: "SQL Injection",
      severity: ["CRITICAL"],
      cisaKevOnly: true,
      pageSize: 5,
    });

    expect(searchRes.total).toBeGreaterThanOrEqual(1);
    expect(searchRes.results.some((c) => c.id === "CVE-2024-9999")).toBe(true);
  });

  it("records and retrieves provenance audit log", () => {
    const prov = CveRepository.getProvenance("CVE-2024-9999");
    expect(prov.length).toBeGreaterThanOrEqual(1);
    expect(prov[0]?.cveId || prov[0]?.sourceId).toBeDefined();
  });

  it("aggregates database statistics accurately", () => {
    const stats = CveRepository.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(1);
    expect(stats.critical).toBeGreaterThanOrEqual(1);
    expect(stats.cisaKev).toBeGreaterThanOrEqual(1);
  });
});
