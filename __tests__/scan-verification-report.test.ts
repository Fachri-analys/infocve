import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DependencyFinding, DependencyScanReport } from "@/lib/scanner/types";

let dbModule: typeof import("@/lib/db");
let saveDependencyScan: typeof import("@/lib/scanner/scan-repository").saveDependencyScan;
let getAuthorizedDependencyScan: typeof import("@/lib/scanner/scan-repository").getAuthorizedDependencyScan;
let buildSecurityPdf: typeof import("@/lib/scanner/report").buildSecurityPdf;
let compareDependencyScans: typeof import("@/lib/scanner/verification").compareDependencyScans;

beforeAll(async () => {
  process.env.TEST_DB = "memory";
  dbModule = await import("@/lib/db");
  ({ saveDependencyScan, getAuthorizedDependencyScan } = await import("@/lib/scanner/scan-repository"));
  ({ buildSecurityPdf } = await import("@/lib/scanner/report"));
  ({ compareDependencyScans } = await import("@/lib/scanner/verification"));
  dbModule.getDb();
});

afterAll(() => {
  dbModule.closeDb();
  delete process.env.TEST_DB;
});

const finding: DependencyFinding = {
  key: "CVE-2025-1234|lodash|4.17.20",
  cveId: "CVE-2025-1234",
  osvIds: ["GHSA-demo"],
  packageName: "lodash",
  version: "4.17.20",
  direct: false,
  transitive: true,
  locations: ["node_modules/app/node_modules/lodash"],
  priority: "P2",
  prioritySource: "OSV severity dipetakan dengan metodologi prioritas InfoCVE",
  priorityReasons: ["Tingkat keparahan teknis OSV berada pada level tinggi."],
  severity: "HIGH",
  summary: "Contoh kerentanan.",
  advisoryDetails: "Detail dari advisori.",
  affectedRanges: ["< 4.17.21"],
  fixedVersions: ["4.17.21"],
  upgradeCommand: "npm install --save-exact lodash@4.17.21",
  temporaryMitigation: null,
  references: [{ type: "ADVISORY", url: "https://example.com/advisory" }],
  advisoryReferences: [{ type: "ADVISORY", url: "https://example.com/advisory" }],
  sourceConflicts: [],
  matchStatus: "CONFIRMED",
  sourceEvidence: [{
    source: "OSV", advisoryId: "GHSA-demo", url: "https://osv.dev/vulnerability/GHSA-demo",
    fetchedAt: "2026-10-31T00:00:00.000Z", packageName: "lodash", ecosystem: "npm",
    affectedRanges: ["< 4.17.21"], evaluation: "AFFECTED", reason: "Exact identity and SemVer range match.",
    observationType: "ADVISORY_RESPONSE",
    rightsReviewStatus: "NEEDS_REVIEW",
    dataRightsNote: "OSV record license follows its upstream database; review source-specific terms.",
    dataRightsUrl: "https://google.github.io/osv.dev/data/",
  }],
  verificationStatus: "UNVERIFIED",
  currentDetected: true,
};

function makeReport(overrides: Partial<DependencyScanReport> = {}): DependencyScanReport {
  return {
    scanId: "91c1c5f0-1a10-4ef1-8cd3-eadf06432cc2",
    parentScanId: null,
    scannedAt: "2026-10-31T00:00:00.000Z",
    status: "COMPLETED",
    scope: { ecosystem: "npm", projectName: "demo", lockfileVersion: 3, packageCount: 3, directCount: 1, transitiveCount: 2, dataSources: ["OSV.dev"] },
    packages: [{ name: "lodash", version: "4.17.20", direct: false, transitive: true, locations: finding.locations }],
    findings: [{ ...finding }],
    warnings: [],
    limitations: ["Hasil scanner bukan bukti aplikasi sepenuhnya aman."],
    sourceAttributions: [{
      sourceId: "OSV", sourceName: "OSV.dev aggregator", sourceUrl: "https://osv.dev",
      termsUrl: "https://google.github.io/osv.dev/data/",
      rightsNote: "Lisensi record mengikuti database asal dan harus diperiksa per advisori.",
      rightsReviewStatus: "NEEDS_REVIEW",
    }],
    auditTrail: [{ scan_id: "91c1c5f0-1a10-4ef1-8cd3-eadf06432cc2", timestamp: "2026-10-31T00:00:00.000Z", stage: "matching", status: "CONFIRMED", package: "lodash", version: "4.17.20", cve: "CVE-2025-1234", decision: "POTENTIALLY_AFFECTED", reason: "OSV and GHSA agree." }],
    ...overrides,
  };
}

describe("dependency remediation verification", () => {
  it("marks an issue still present when the same CVE remains in a complete rescan", () => {
    const current = makeReport({ scanId: "d3ac3993-a5ca-4f73-9f05-0ebfd5cb7fd0", parentScanId: finding.key });
    const compared = compareDependencyScans(makeReport(), current);

    expect(compared.findings[0]?.verificationStatus).toBe("STILL_DETECTED");
    expect(compared.findings[0]?.previousVersion).toBe("4.17.20");
  });

  it("marks an absent finding resolved only after a complete scan", () => {
    const current = makeReport({
      status: "COMPLETED",
      packages: [{ name: "lodash", version: "4.17.21", direct: false, transitive: true, locations: finding.locations }],
      findings: [],
    });
    const compared = compareDependencyScans(makeReport(), current);

    expect(compared.findings[0]).toMatchObject({
      verificationStatus: "RESOLVED",
      currentDetected: false,
      version: "4.17.21",
      previousVersion: "4.17.20",
    });
  });

  it("keeps an absent finding unverified when the latest scan is incomplete", () => {
    const current = makeReport({ status: "FAILED", findings: [], warnings: [{ code: "OSV_API_ERROR", message: "API unavailable" }] });
    const compared = compareDependencyScans(makeReport(), current);

    expect(compared.findings[0]?.verificationStatus).toBe("UNVERIFIED");
    expect(compared.findings[0]?.currentDetected).toBe(false);
  });

  it("does not resolve an unconfirmed candidate or a scan for a different project", () => {
    const unconfirmed = makeReport({ findings: [{ ...finding, matchStatus: "NEEDS_REVIEW" }] });
    const emptyComplete = makeReport({ status: "COMPLETED", findings: [], packages: [] });
    const unresolvedCandidate = compareDependencyScans(unconfirmed, emptyComplete);
    expect(unresolvedCandidate.findings[0]?.verificationStatus).toBe("UNVERIFIED");

    const differentProject = makeReport({ scope: { ...makeReport().scope, projectName: "other-project" }, findings: [] });
    const changedScope = compareDependencyScans(makeReport(), differentProject);
    expect(changedScope.findings[0]?.verificationStatus).toBe("UNVERIFIED");
  });
});

describe("scan history and report generation", () => {
  it("authorizes scan history only with its random capability token", () => {
    const report = makeReport();
    saveDependencyScan(report, "a".repeat(64));

    expect(getAuthorizedDependencyScan(report.scanId, "wrong-token")).toBeNull();
    expect(getAuthorizedDependencyScan(report.scanId, "a".repeat(64))).toEqual(report);
  });

  it("keeps JSON and PDF exports consistent with stored scan facts", () => {
    const report = makeReport({ scanId: "bd8727e7-5d0d-4e0b-8467-0a663e98d5c2" });
    saveDependencyScan(report, "b".repeat(64));
    const json = getAuthorizedDependencyScan(report.scanId, "b".repeat(64));
    const pdf = buildSecurityPdf(json!);
    const pdfText = pdf.toString("latin1");

    expect(json?.findings[0]?.cveId).toBe("CVE-2025-1234");
    expect(json?.sourceAttributions?.[0]?.rightsReviewStatus).toBe("NEEDS_REVIEW");
    expect(pdf.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
    expect(pdfText).toContain("CVE-2025-1234");
    expect(pdfText).toContain("P2");
    expect(pdfText).toContain("UNVERIFIED");
    expect(pdfText).toContain("OSV and GHSA agree.");
    expect(pdfText).toContain("Bukti OSV: AFFECTED");
    expect(pdfText).toContain("Atribusi dan ketentuan sumber:");
    expect(pdfText).toContain("OSV.dev aggregator [NEEDS_REVIEW]");
    expect(pdfText).toContain("status ketentuan NEEDS_REVIEW");
    expect(pdfText).toContain("google.github.io/osv.dev/data/");
    expect(pdfText).toContain("jenis waktu ADVISORY_RESPONSE");
    expect(pdfText).toContain("The MITRE Corporation");
    expect(pdfText).toContain("Hasil scanner bukan bukti aplikasi sepenuhnya aman.");
  });
});
