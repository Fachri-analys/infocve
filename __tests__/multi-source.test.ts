import { describe, expect, it } from "vitest";
import { PocClassifier } from "@/lib/sources/poc";
import { ThreatIntelligenceAggregator } from "@/lib/sources/aggregator";
import type { CVE } from "@/types/cve";

describe("Multi-Source Intelligence & PoC Classification", () => {
  it("classifies exploit and PoC references correctly", () => {
    const exploitRef = { url: "https://www.exploit-db.com/exploits/50000", source: "Exploit-DB" };
    const pocRef = { url: "https://github.com/someone/cve-2024-1234-poc", source: "GitHub" };
    const genericRef = { url: "https://vendor.com/security-bulletin-123", source: "Vendor" };

    const c1 = PocClassifier.classifyReference(exploitRef);
    expect(c1.isExploit).toBe(true);
    expect(c1.isPoc).toBe(true);

    const c2 = PocClassifier.classifyReference(pocRef);
    expect(c2.isPoc).toBe(true);

    const c3 = PocClassifier.classifyReference(genericRef);
    expect(c3.isExploit).toBe(false);
    expect(c3.isPoc).toBe(false);
  });

  it("enriches references list and calculates aggregate flags", () => {
    const refs = [
      { url: "https://github.com/poc-author/CVE-2024-0001-exploit", source: "GitHub" },
      { url: "https://vendor.com/release-notes", source: "Vendor" },
    ];

    const { enriched, hasPoc, hasExploit } = PocClassifier.enrichReferences(refs);
    expect(hasPoc).toBe(true);
    expect(hasExploit).toBeDefined();
    expect(enriched[0]?.isPoc).toBe(true);
    expect(enriched[1]?.isPoc).toBe(false);
  });

  it("enriches CVE with multi-source intelligence feeds", async () => {
    const rawCve: CVE = {
      id: "CVE-2021-44228",
      title: "Apache Log4j RCE",
      year: 2021,
      publishedDate: "2021-12-10T00:00:00.000Z",
      lastModifiedDate: "2021-12-11T00:00:00.000Z",
      descriptionEn: "Remote code execution in Log4j JNDI lookup.",
      descriptionId: "Eksekusi kode jarak jauh pada modul Log4j JNDI.",
      vendor: "Apache",
      product: "Log4j",
      category: "framework-library",
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
      cwe: [{ id: "CWE-502", name: "Deserialization" }],
      affected: [{ vendor: "Apache", product: "Log4j", versions: ["2.0", "2.14.1"] }],
      references: [{ url: "https://github.com/tangxiaofeng7/apache-log4j-poc", source: "GitHub" }],
    };

    const enriched = await ThreatIntelligenceAggregator.enrich(rawCve, false);

    expect(enriched.id).toBe("CVE-2021-44228");
    expect(enriched.hasPoc).toBe(true);
    expect(enriched.sources).toBeDefined();
    expect(enriched.sources?.length).toBeGreaterThanOrEqual(1);
  });
});
