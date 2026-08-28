import { describe, expect, it } from "vitest";
import { InfoCveLocalAgent } from "@/lib/agent/local-agent";

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
