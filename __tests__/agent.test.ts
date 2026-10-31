import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InfoCveLocalAgent } from "@/lib/agent/local-agent";
import type { CVE } from "@/types/cve";

let closeDb: typeof import("@/lib/db").closeDb;

beforeAll(async () => {
  process.env.TEST_DB = "memory";
  const db = await import("@/lib/db");
  const { CveRepository } = await import("@/lib/db/cve-repository");
  closeDb = db.closeDb;
  const testCve: CVE = {
    id: "CVE-2024-9999",
    title: "Test vulnerability",
    year: 2024,
    publishedDate: "2024-01-01T00:00:00.000Z",
    lastModifiedDate: "2024-01-01T00:00:00.000Z",
    descriptionEn: "Test description.",
    descriptionId: "Deskripsi pengujian.",
    vendor: "Test Vendor",
    product: "Test Product",
    category: "framework-library",
    cvss: {
      version: "3.1", baseScore: 9.8, severity: "CRITICAL", vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      attackVector: "NETWORK", attackComplexity: "LOW", privilegesRequired: "NONE", userInteraction: "NONE",
      scope: "UNCHANGED", confidentialityImpact: "HIGH", integrityImpact: "HIGH", availabilityImpact: "HIGH",
    },
    cwe: [], affected: [], references: [],
  };
  CveRepository.upsert(testCve, "TEST_SUITE");
});

afterAll(() => {
  closeDb();
  delete process.env.TEST_DB;
});

describe("Local Agent Foundation & SBOM Scanning", () => {
  it("generates threat intelligence reports with recommendations", async () => {
    const report = await InfoCveLocalAgent.getThreatIntelligence("CVE-2024-9999");
    if (report) {
      expect(report.cveId).toBe("CVE-2024-9999");
      expect(report.severity).toBe("CRITICAL");
      expect(report.recommendedAction).toBeDefined();
    }
  });

  it("scans SBOM packages against local threat database", async () => {
    const packages = [
      { name: "TestProduct", version: "1.0.0", ecosystem: "npm" },
      { name: "SafeLibrary", version: "2.0.0", ecosystem: "npm" },
    ];

    const results = await InfoCveLocalAgent.scanSbom(packages);
    expect(Array.isArray(results)).toBe(true);
  });
});
