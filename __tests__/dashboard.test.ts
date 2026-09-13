import { describe, it, expect } from "vitest";
import type { CVE, CVSSMetrics } from "@/types/cve";
import type { CisaKevEntry } from "@/lib/sources/cisa-kev";
import {
  computeSeverityDistribution,
  computeCvssStats,
  computeTopItems,
  computeTopCwes,
  computeTrend,
  computePriorityBreakdown,
  computeCisaKevStats,
  computeEpssStats,
} from "@/lib/dashboard-stats";

function createCvssMetrics(baseScore: number, severity: CVSSMetrics["severity"]): CVSSMetrics {
  return {
    version: "3.1",
    baseScore,
    severity,
    vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    attackVector: "NETWORK",
    attackComplexity: "LOW",
    privilegesRequired: "NONE",
    userInteraction: "NONE",
    scope: "UNCHANGED",
    confidentialityImpact: "HIGH",
    integrityImpact: "HIGH",
    availabilityImpact: "HIGH",
  };
}

describe("Dashboard Statistics Aggregation", () => {
  const mockCves: CVE[] = [
    {
      id: "CVE-2024-0001",
      title: "Critical Vulnerability in Apache HTTP Server",
      descriptionEn: "Sample description",
      descriptionId: "Deskripsi sampel",
      year: 2024,
      publishedDate: "2024-02-10T10:00:00.000",
      lastModifiedDate: "2024-02-12T10:00:00.000",
      vendor: "Apache",
      product: "HTTP Server",
      affected: [],
      category: "web-application",
      cvss: createCvssMetrics(9.8, "CRITICAL"),
      cwe: [{ id: "CWE-787", name: "Out-of-bounds Write" }],
      references: [],
      sources: ["NVD"],
    },
    {
      id: "CVE-2024-0002",
      title: "High Severity Flaw in Microsoft Windows",
      descriptionEn: "Sample description",
      descriptionId: "Deskripsi sampel",
      year: 2024,
      publishedDate: "2024-02-15T12:00:00.000",
      lastModifiedDate: "2024-02-16T12:00:00.000",
      vendor: "Microsoft",
      product: "Windows",
      affected: [],
      category: "operating-system",
      cvss: createCvssMetrics(7.8, "HIGH"),
      cwe: [{ id: "CWE-269", name: "Improper Privilege Management" }],
      references: [],
      sources: ["NVD"],
    },
    {
      id: "CVE-2024-0003",
      title: "Medium Severity XSS in Apache Tomcat",
      descriptionEn: "Sample description",
      descriptionId: "Deskripsi sampel",
      year: 2024,
      publishedDate: "2024-02-15T15:00:00.000",
      lastModifiedDate: "2024-02-16T15:00:00.000",
      vendor: "Apache",
      product: "Tomcat",
      affected: [],
      category: "web-application",
      cvss: createCvssMetrics(5.4, "MEDIUM"),
      cwe: [
        { id: "CWE-79", name: "Cross-site Scripting" },
        { id: "CWE-787", name: "Out-of-bounds Write" },
      ],
      references: [],
      sources: ["NVD"],
    },
    {
      id: "CVE-2024-0004",
      title: "Low Severity Issue in Linux Kernel",
      descriptionEn: "Sample description",
      descriptionId: "Deskripsi sampel",
      year: 2024,
      publishedDate: "2024-02-22T08:00:00.000",
      lastModifiedDate: "2024-02-23T08:00:00.000",
      vendor: "Linux",
      product: "Kernel",
      affected: [],
      category: "operating-system",
      cvss: createCvssMetrics(3.3, "LOW"),
      cwe: [],
      references: [],
      sources: ["NVD"],
    },
  ];

  it("1. computes severity distribution and percentages accurately", () => {
    const distribution = computeSeverityDistribution(mockCves);

    expect(distribution).toHaveLength(6);
    const critical = distribution.find((d) => d.severity === "CRITICAL");
    const high = distribution.find((d) => d.severity === "HIGH");
    const medium = distribution.find((d) => d.severity === "MEDIUM");
    const low = distribution.find((d) => d.severity === "LOW");
    const unknown = distribution.find((d) => d.severity === "UNKNOWN");

    expect(critical?.count).toBe(1);
    expect(critical?.percentage).toBe(25);
    expect(high?.count).toBe(1);
    expect(high?.percentage).toBe(25);
    expect(medium?.count).toBe(1);
    expect(low?.count).toBe(1);
    expect(unknown?.count).toBe(0);
  });

  it("2. computes CVSS statistical metrics and brackets properly", () => {
    const cvss = computeCvssStats(mockCves);

    expect(cvss.ratedCount).toBe(4);
    expect(cvss.unratedCount).toBe(0);
    // (9.8 + 7.8 + 5.4 + 3.3) / 4 = 26.3 / 4 = 6.575 -> 6.6
    expect(cvss.averageScore).toBe(6.6);
    expect(cvss.maxScore).toBe(9.8);
    expect(cvss.brackets).toHaveLength(5);

    const criticalBracket = cvss.brackets.find((b) => b.range === "9.0 - 10.0");
    expect(criticalBracket?.count).toBe(1);
    expect(criticalBracket?.percentage).toBe(25);
  });

  it("3. extracts top vendors and products by frequency", () => {
    const topVendors = computeTopItems(mockCves, (c) => c.vendor);
    expect(topVendors[0]?.name).toBe("Apache");
    expect(topVendors[0]?.count).toBe(2);
    expect(topVendors[0]?.percentage).toBe(50);

    const topProducts = computeTopItems(mockCves, (c) => c.product);
    expect(topProducts).toHaveLength(4);
  });

  it("4. extracts top CWE weaknesses correctly", () => {
    const topCwes = computeTopCwes(mockCves);
    expect(topCwes[0]?.id).toBe("CWE-787");
    expect(topCwes[0]?.count).toBe(2);
    expect(topCwes[0]?.name).toBe("Out-of-bounds Write");

    const cwe79 = topCwes.find((c) => c.id === "CWE-79");
    expect(cwe79?.count).toBe(1);
  });

  it("5. groups publication dates into chronological weekly trend buckets", () => {
    const trend = computeTrend(mockCves);
    expect(trend.length).toBeGreaterThan(0);

    const totalTrendSum = trend.reduce((sum, item) => sum + item.total, 0);
    expect(totalTrendSum).toBe(mockCves.length);

    const totalCriticalSum = trend.reduce((sum, item) => sum + item.critical, 0);
    expect(totalCriticalSum).toBe(1);
  });

  it("6. computes InfoCVE Priority tier breakdown", () => {
    const priorities = computePriorityBreakdown(mockCves);
    expect(priorities).toHaveLength(4);

    const p2 = priorities.find((p) => p.tier === "P2");
    const p3 = priorities.find((p) => p.tier === "P3");
    const p4 = priorities.find((p) => p.tier === "P4");

    // CVE-2024-0001 (CVSS 9.8) maps to P2 because it is not in KEV and EPSS is not very high
    expect(p2?.count).toBeGreaterThanOrEqual(1);
    expect(p3?.count).toBeGreaterThanOrEqual(1);
    expect(p4?.count).toBeGreaterThanOrEqual(1);
  });

  it("7. computes CISA KEV statistics accurately with catalog and ransomware data", () => {
    const cisaMap = new Map<string, CisaKevEntry>();
    cisaMap.set("CVE-2024-0001", {
      cveID: "CVE-2024-0001",
      vendorProject: "Apache",
      product: "HTTP Server",
      vulnerabilityName: "Apache Buffer Overflow",
      dateAdded: "2024-02-15",
      shortDescription: "Actively exploited buffer overflow",
      requiredAction: "Apply patch",
      dueDate: "2024-03-01",
      knownRansomwareCampaignUse: "Known",
    });

    const cisaStats = computeCisaKevStats(mockCves, cisaMap);
    expect(cisaStats.sampleInKev).toBe(1);
    expect(cisaStats.sampleInKevPercentage).toBe(25);
    expect(cisaStats.catalogTotal).toBe(1);
    expect(cisaStats.ransomwareCount).toBe(1);
    expect(cisaStats.topKevVendors[0]?.vendor).toBe("Apache");
  });

  it("8. evaluates EPSS statistics and risk thresholds", () => {
    const epssMap = new Map([
      ["CVE-2024-0001", { score: 0.65, percentile: 0.99 }],
      ["CVE-2024-0002", { score: 0.15, percentile: 0.88 }],
      ["CVE-2024-0003", { score: 0.02, percentile: 0.35 }],
    ]);

    const epssStats = computeEpssStats(mockCves, epssMap);
    expect(epssStats.evaluatedCount).toBe(3);
    expect(epssStats.criticalRiskCount).toBe(1); // score > 0.5 (0.65)
    expect(epssStats.highRiskCount).toBe(1); // 0.1 < score <= 0.5 (0.15)
    expect(epssStats.topEpssCves[0]?.id).toBe("CVE-2024-0001");
  });

  it("9. gracefully handles empty datasets without dividing by zero or throwing", () => {
    const emptyDist = computeSeverityDistribution([]);
    expect(emptyDist).toHaveLength(6);
    expect(emptyDist.every((d) => d.count === 0 && d.percentage === 0)).toBe(true);

    const emptyCvss = computeCvssStats([]);
    expect(emptyCvss.averageScore).toBe(0);
    expect(emptyCvss.medianScore).toBe(0);
    expect(emptyCvss.ratedCount).toBe(0);

    const emptyTop = computeTopItems<CVE>([], (c) => c.vendor);
    expect(emptyTop).toHaveLength(0);

    const emptyCwes = computeTopCwes([]);
    expect(emptyCwes).toHaveLength(0);

    const emptyTrend = computeTrend([]);
    expect(emptyTrend).toHaveLength(0);

    const emptyPriority = computePriorityBreakdown([]);
    expect(emptyPriority).toHaveLength(4);
    expect(emptyPriority.every((p) => p.count === 0 && p.percentage === 0)).toBe(true);
  });
});
