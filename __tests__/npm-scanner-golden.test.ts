import { describe, expect, it } from "vitest";
import goldenCases from "./fixtures/npm-scanner-golden.json";
import { createNpmFindings } from "@/lib/scanner/npm-scanner";
import { parseNpmLock, type DependencyPackage } from "@/lib/scanner/npm-manifest";
import { matchesNpmRange } from "@/lib/scanner/npm-semver";
import type { GithubAdvisory } from "@/lib/scanner/github-advisory-client";
import type { OsvQueryResult, OsvVulnerability } from "@/lib/scanner/osv-client";

type GoldenCase = {
  id: string;
  package: string;
  affectedPackage?: string;
  version: string;
  range: string;
  rangeType?: string;
  conflictingRange?: string;
  cve: string;
  ghsa: string;
  truth: "AFFECTED" | "NOT_AFFECTED" | "UNVERIFIED";
  dependency: "direct" | "transitive";
  reference: string;
};
const cases = goldenCases as GoldenCase[];

function makeCase(testCase: GoldenCase) {
  const dependencyName = testCase.package;
  const affectedPackage = testCase.affectedPackage ?? dependencyName;
  const rangeType = testCase.rangeType ?? "SEMVER";
  const upperBound = testCase.range.match(/<\s*(\d+\.\d+\.\d+)/)?.[1];
  const ghsaRange = testCase.conflictingRange ?? testCase.range;
  const ghsaUpperBound = ghsaRange.match(/<\s*(\d+\.\d+\.\d+)/)?.[1];
  const lowerBound = testCase.range.match(/>=\s*(\d+\.\d+\.\d+)/)?.[1] ?? "0";
  const events = upperBound
    ? [{ introduced: lowerBound }, { fixed: upperBound }]
    : [{ introduced: testCase.range }];
  const dependency: DependencyPackage = {
    name: dependencyName,
    version: testCase.version,
    purl: `pkg:npm/${dependencyName}`,
    direct: testCase.dependency === "direct",
    transitive: testCase.dependency === "transitive",
    locations: [testCase.dependency === "direct" ? `node_modules/${dependencyName}` : `node_modules/parent/node_modules/${dependencyName}`],
    declaredRanges: [],
  };
  const advisory: OsvVulnerability = {
    id: testCase.ghsa,
    aliases: [testCase.cve],
    references: [{ type: "ADVISORY", url: testCase.reference }],
    modified: "2025-01-01T00:00:00Z",
    affected: [{
      package: { ecosystem: "npm", name: affectedPackage },
      ranges: [{ type: rangeType, events }],
    }],
  };
  const osvResult: OsvQueryResult = {
    results: [{ packageKey: `${dependencyName}\0${testCase.version}`, vulnerabilities: [advisory] }],
    errors: [],
    completedPackages: 1,
  };
  const ghsa: GithubAdvisory = {
    id: testCase.ghsa.toUpperCase(),
    cveId: testCase.cve,
    updatedAt: "2025-01-01T00:00:00Z",
    fetchedAt: "2026-10-31T00:00:00.000Z",
    url: `https://api.github.com/advisories/${testCase.ghsa}`,
    vulnerabilities: [{
      package: { ecosystem: "npm", name: affectedPackage, purl: `pkg:npm/${affectedPackage}` },
      vulnerableVersionRange: ghsaRange,
      firstPatchedVersion: ghsaUpperBound ?? null,
    }],
    references: [],
  };
  return { dependency, osvResult, ghsa };
}

describe("npm scanner golden corpus and reproducible metrics", () => {
  it("measures exact-identity/version matching against pinned advisory cases", () => {
    const counts = { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0, unverified: 0 };
    const scannerStatuses = { CONFIRMED: 0, NEEDS_REVIEW: 0, UNVERIFIED: 0 };

    for (const testCase of cases) {
      const { dependency, osvResult, ghsa } = makeCase(testCase);
      const finding = createNpmFindings(
        [dependency],
        osvResult,
        (cveId) => ({
          id: cveId,
          lastModifiedDate: "2025-01-01T00:00:00Z",
          product: "snapshot product",
          affected: [{ vendor: "nvd", product: "unrelated-cpe-product", versions: ["<1.0.0"] }],
        } as never),
        [],
        new Map([[ghsa.id, ghsa]])
      )[0];
      const detected = Boolean(finding?.currentDetected);
      if (finding) scannerStatuses[finding.matchStatus] += 1;

      if (testCase.truth === "UNVERIFIED") {
        counts.unverified += 1;
        expect(finding?.matchStatus).toMatch(/NEEDS_REVIEW|UNVERIFIED/);
        if (testCase.id === "conflicting-range-needs-review") expect(finding?.sourceConflicts.length).toBeGreaterThan(0);
        continue;
      }
      if (testCase.truth === "AFFECTED") {
        if (detected) counts.truePositive += 1;
        else counts.falseNegative += 1;
      } else if (detected) counts.falsePositive += 1;
      else counts.trueNegative += 1;
    }

    const precision = counts.truePositive / (counts.truePositive + counts.falsePositive);
    const recall = counts.truePositive / (counts.truePositive + counts.falseNegative);
    const f1 = 2 * precision * recall / (precision + recall);
    const falsePositiveRate = counts.falsePositive / (counts.falsePositive + counts.trueNegative);
    const falseNegativeRate = counts.falseNegative / (counts.falseNegative + counts.truePositive);

    expect(counts).toEqual({ truePositive: 8, falsePositive: 0, trueNegative: 10, falseNegative: 0, unverified: 2 });
    expect(scannerStatuses).toEqual({ CONFIRMED: 0, NEEDS_REVIEW: 19, UNVERIFIED: 1 });
    expect({ precision, recall, f1, falsePositiveRate, falseNegativeRate }).toEqual({
      precision: 1, recall: 1, f1: 1, falsePositiveRate: 0, falseNegativeRate: 0,
    });
    console.info("InfoCVE golden metrics (matching-only, curated cases):", { ...counts, scannerStatuses, precision, recall, f1, falsePositiveRate, falseNegativeRate });
  });

  it("keeps deterministic randomized SemVer and lockfile inputs from throwing", () => {
    let seed = 0x1f0c0e;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    const alphabet = "0123456789abcdef.+-<>=~^|x* abc";
    for (let sample = 0; sample < 300; sample += 1) {
      const length = Math.floor(random() * 32);
      const value = Array.from({ length }, () => alphabet[Math.floor(random() * alphabet.length)]).join("");
      expect(() => matchesNpmRange(value, value)).not.toThrow();
      expect(() => parseNpmLock(
        { dependencies: { [value || "bad"]: value || "?" } },
        { lockfileVersion: 3, packages: { "": {}, [`node_modules/${value || "bad"}`]: { version: value } } }
      )).not.toThrow();
    }
  });
});
