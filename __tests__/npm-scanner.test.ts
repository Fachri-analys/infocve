import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { parseNpmLock, type PackageJsonShape, type PackageLockShape } from "@/lib/scanner/npm-manifest";
import { matchesNpmRange, isOsvVersionAffected } from "@/lib/scanner/npm-semver";
import { createNpmFindings, scanNpmDependencies } from "@/lib/scanner/npm-scanner";
import { createNpmPurl, npmPurlMatches, parseNpmPurl } from "@/lib/scanner/npm-purl";
import type { DependencyPackage } from "@/lib/scanner/npm-manifest";
import type { OsvQueryResult } from "@/lib/scanner/osv-client";
import type { ScanWarning } from "@/lib/scanner/types";
import type { CVE } from "@/types/cve";
import type { GithubAdvisory } from "@/lib/scanner/github-advisory-client";

afterEach(() => vi.restoreAllMocks());

describe("npm dependency inventory", () => {
  it("finds direct and transitive lockfile v3 packages and keeps installed versions", () => {
    const manifest: PackageJsonShape = { dependencies: { alpha: "^1.0.0" } };
    const lock: PackageLockShape = {
      lockfileVersion: 3,
      packages: {
        "": { dependencies: { alpha: "^1.0.0" } },
        "node_modules/alpha": { version: "1.2.3", dependencies: { beta: "~2.0.0" } },
        "node_modules/alpha/node_modules/beta": { version: "2.0.5" },
      },
    };

    const inventory = parseNpmLock(manifest, lock);

    expect(inventory.packages).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "alpha", version: "1.2.3", direct: true }),
      expect.objectContaining({ name: "beta", version: "2.0.5", direct: false }),
    ]));
    expect(inventory.complete).toBe(true);
  });

  it("reports direct manifest-lock conflicts and missing exact versions", () => {
    const inventory = parseNpmLock(
      { dependencies: { alpha: "^2.0.0", missing: "^1.0.0" } },
      { lockfileVersion: 3, packages: { "": { dependencies: { alpha: "^2.0.0", missing: "^1.0.0" } }, "node_modules/alpha": { version: "1.9.0" } } }
    );

    expect(inventory.complete).toBe(false);
    expect(inventory.warnings.map((warning) => warning.code)).toContain("LOCK_VERSION_CONFLICT");
    expect(inventory.warnings.map((warning) => warning.code)).toContain("MISSING_LOCKED_DEPENDENCY");
  });

  it("supports npm v1 nested dependency records", () => {
    const inventory = parseNpmLock(
      { dependencies: { alpha: "1.0.0" } },
      { lockfileVersion: 1, dependencies: { alpha: { version: "1.0.0", dependencies: { beta: { version: "2.1.0" } } } } }
    );

    expect(inventory.packages).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "alpha", direct: true }),
      expect.objectContaining({ name: "beta", direct: false }),
    ]));
  });

  it("rejects traversal-like package lock locations and marks coverage incomplete", () => {
    const inventory = parseNpmLock(
      { dependencies: { lodash: "^4.17.20" } },
      { lockfileVersion: 3, packages: {
        "": { dependencies: { lodash: "^4.17.20" } },
        "node_modules/../node_modules/lodash": { version: "4.17.20" },
      } }
    );

    expect(inventory.complete).toBe(false);
    expect(inventory.packages).toHaveLength(0);
    expect(inventory.warnings.map((warning) => warning.code)).toContain("INVALID_LOCKED_PACKAGE_PATH");
  });

  it("keeps duplicate package locations while distinguishing direct and transitive installs", () => {
    const inventory = parseNpmLock(
      { dependencies: { alpha: "^1.0.0" } },
      { lockfileVersion: 3, packages: {
        "": { dependencies: { alpha: "^1.0.0" } },
        "node_modules/alpha": { version: "1.2.3" },
        "node_modules/beta": { version: "2.0.0" },
        "node_modules/beta/node_modules/alpha": { version: "1.2.3" },
      } }
    );

    const alpha = inventory.packages.find((item) => item.name === "alpha");
    expect(alpha).toMatchObject({ direct: true, transitive: true });
    expect(alpha?.locations).toHaveLength(2);
  });

  it("resolves npm aliases to the locked package identity before matching", () => {
    const inventory = parseNpmLock(
      { dependencies: { "lodash-alias": "npm:lodash@^4.17.0" } },
      { lockfileVersion: 3, packages: {
        "": { dependencies: { "lodash-alias": "npm:lodash@^4.17.0" } },
        "node_modules/lodash-alias": { name: "lodash", version: "4.17.20" },
      } }
    );

    expect(inventory.complete).toBe(true);
    expect(inventory.packages[0]).toMatchObject({
      name: "lodash",
      purl: "pkg:npm/lodash",
      version: "4.17.20",
      direct: true,
      locations: ["node_modules/lodash-alias"],
    });
    expect(inventory.warnings).toHaveLength(0);
  });
});

describe("CVE matching for npm packages", () => {
  const dependency: DependencyPackage = {
    name: "lodash", version: "4.17.20", direct: false, transitive: true,
    locations: ["node_modules/alpha/node_modules/lodash"], declaredRanges: [],
  };
  const osvResult: OsvQueryResult = {
    completedPackages: 1,
    errors: [],
    results: [{
      packageKey: "lodash\0 4.17.20".replace(" ", ""),
      vulnerabilities: [{
        id: "GHSA-35jh-r3h4-6jhm",
        aliases: ["CVE-2021-23337"],
        summary: "Prototype pollution",
        details: "Advisory details from OSV.",
        database_specific: { severity: "HIGH" },
        affected: [{
          package: { ecosystem: "npm", name: "lodash" },
          ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "4.17.21" }] }],
        }],
        references: [{ type: "ADVISORY", url: "https://github.com/advisories/GHSA-35jh-r3h4-6jhm" }],
      }],
    }],
  };

  it("matches CVE aliases only when ecosystem, exact package name, and affected range agree", () => {
    const warnings: ScanWarning[] = [];
    const findings = createNpmFindings([dependency], osvResult, () => null, warnings);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      cveId: "CVE-2021-23337",
      packageName: "lodash",
      version: "4.17.20",
      currentDetected: true,
      fixedVersions: ["4.17.21"],
      verificationStatus: "UNVERIFIED",
    });
    expect(findings[0]?.upgradeCommand).toBe("npm install --save-exact lodash@4.17.21");
    expect(findings[0]?.temporaryMitigation).toBeNull();
    expect(warnings).toHaveLength(0);
  });

  it("does not confirm a CVE when OSV query and affected range data contradict", () => {
    const contradictory = structuredClone(osvResult);
    contradictory.results[0]!.vulnerabilities[0]!.affected![0]!.ranges![0]!.events = [
      { introduced: "4.17.0" }, { fixed: "4.17.10" },
    ];
    const warnings: ScanWarning[] = [];
    const findings = createNpmFindings([dependency], contradictory, () => null, warnings);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ currentDetected: false, matchStatus: "NEEDS_REVIEW" });
    expect(warnings.map((warning) => warning.code)).toContain("OSV_QUERY_DETAIL_CONFLICT");
  });

  it("requires an affected PURL to identify the exact npm package and installed version", () => {
    expect(createNpmPurl("@acme/parser", "1.2.3")).toBe("pkg:npm/%40acme/parser@1.2.3");
    expect(parseNpmPurl("pkg:npm/%40acme/parser@1.2.3")).toEqual({ name: "@acme/parser", version: "1.2.3" });
    expect(npmPurlMatches("pkg:npm/%40acme/parser", "@acme/parser", "1.2.3")).toBe(true);
    expect(npmPurlMatches("pkg:npm/%40acme/parser@1.2.4", "@acme/parser", "1.2.3")).toBe(false);
    expect(npmPurlMatches("pkg:pypi/parser", "parser", "1.2.3")).toBe(false);

    const wrongPackagePurl = structuredClone(osvResult);
    wrongPackagePurl.results[0]!.vulnerabilities[0]!.affected![0]!.package!.purl = "pkg:npm/lodash-es";
    const warnings: ScanWarning[] = [];
    const findings = createNpmFindings([dependency], wrongPackagePurl, () => null, warnings);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ currentDetected: false, matchStatus: "NEEDS_REVIEW" });
    expect(warnings.map((warning) => warning.code)).toContain("OSV_PURL_IDENTITY_CONFLICT");
  });

  it("does not treat an NVD product string as an npm package identity", () => {
    const localCve = {
      id: "CVE-2021-23337",
      affected: [{ vendor: "OpenJS", product: "lodash", versions: [">= 4.17.21"] }],
    } as CVE;
    const warnings: ScanWarning[] = [];
    const findings = createNpmFindings([dependency], osvResult, () => localCve, warnings);

    expect(findings[0]?.sourceConflicts).toHaveLength(0);
    expect(findings[0]?.sourceEvidence.find((item) => item.source === "NVD")).toMatchObject({
      evaluation: "NOT_COMPARABLE",
      affectedRanges: [">= 4.17.21"],
    });
    expect(findings[0]?.matchStatus).toBe("NEEDS_REVIEW");
    expect(warnings.map((warning) => warning.code)).not.toContain("SOURCE_CONFLICT");
  });

  it("keeps a match in Needs Review when NVD lacks an npm package identity", () => {
    const ghsa: GithubAdvisory = {
      id: "GHSA-35JH-R3H4-6JHM", cveId: "CVE-2021-23337", updatedAt: "2025-01-01T00:00:00Z",
      fetchedAt: "2026-10-31T00:00:00.000Z", url: "https://api.github.com/advisories/GHSA-35jh-r3h4-6jhm",
      vulnerabilities: [{ package: { ecosystem: "npm", name: "lodash", purl: "pkg:npm/lodash" }, vulnerableVersionRange: "< 4.17.21", firstPatchedVersion: "4.17.21" }],
      references: ["https://lodash.com/blog/security-advisories"],
    };
    const localCve = { id: "CVE-2021-23337", affected: [{ vendor: "unknown", product: "unrelated-product", versions: ["<1.0.0"] }] } as CVE;
    const findings = createNpmFindings([dependency], osvResult, () => localCve, [], new Map([[ghsa.id, ghsa]]));

    expect(findings[0]).toMatchObject({ matchStatus: "NEEDS_REVIEW", currentDetected: true, fixedVersions: ["4.17.21"] });
    expect(findings[0]?.sourceEvidence.map((item) => item.source)).toEqual(expect.arrayContaining(["OSV", "GITHUB_SECURITY_ADVISORIES", "NVD", "VENDOR_ADVISORY"]));
    expect(findings[0]?.sourceEvidence.find((item) => item.source === "OSV")).toMatchObject({
      observationType: "ADVISORY_RESPONSE",
      dataRightsUrl: "https://google.github.io/osv.dev/data/",
      rightsReviewStatus: "NEEDS_REVIEW",
    });
    expect(findings[0]?.sourceEvidence.find((item) => item.source === "GITHUB_SECURITY_ADVISORIES")).toMatchObject({
      rightsReviewStatus: "TERMS_IDENTIFIED",
      dataRightsNote: expect.stringContaining("CC BY 4.0"),
    });
    expect(findings[0]?.sourceEvidence.find((item) => item.source === "NVD")?.observationType).toBe("LOCAL_SNAPSHOT");
    expect(findings[0]?.sourceEvidence.find((item) => item.source === "VENDOR_ADVISORY")).toMatchObject({
      evaluation: "NOT_COMPARABLE",
      observationType: "REFERENCE_ONLY",
      dataRightsUrl: null,
      rightsReviewStatus: "NEEDS_REVIEW",
    });
  });

  it("keeps contradictory exact-package advisories visible as Needs Review", () => {
    const conflict: GithubAdvisory = {
      id: "GHSA-35JH-R3H4-6JHM", cveId: "CVE-2021-23337", updatedAt: null,
      fetchedAt: "2026-10-31T00:00:00.000Z", url: "https://api.github.com/advisories/GHSA-35jh-r3h4-6jhm",
      vulnerabilities: [{ package: { ecosystem: "npm", name: "lodash" }, vulnerableVersionRange: ">=4.17.21", firstPatchedVersion: null }], references: [],
    };
    const findings = createNpmFindings([dependency], osvResult, () => null, [], new Map([[conflict.id, conflict]]));

    expect(findings[0]).toMatchObject({ matchStatus: "NEEDS_REVIEW", currentDetected: true });
    expect(findings[0]?.sourceConflicts).toHaveLength(1);
  });

  it("withholds an upgrade command when OSV and GHSA list different fixes", () => {
    const conflictingFix: GithubAdvisory = {
      id: "GHSA-35JH-R3H4-6JHM", cveId: "CVE-2021-23337", updatedAt: null,
      fetchedAt: "2026-10-31T00:00:00.000Z", url: "https://api.github.com/advisories/GHSA-35jh-r3h4-6jhm",
      vulnerabilities: [{ package: { ecosystem: "npm", name: "lodash" }, vulnerableVersionRange: "<4.17.22", firstPatchedVersion: "4.17.22" }], references: [],
    };
    const findings = createNpmFindings([dependency], osvResult, () => null, [], new Map([[conflictingFix.id, conflictingFix]]));

    expect(findings[0]).toMatchObject({ matchStatus: "NEEDS_REVIEW", upgradeCommand: null });
    expect(findings[0]?.fixedVersions).toEqual(["4.17.21", "4.17.22"]);
  });

  it("distinguishes successful empty scans from API failures", async () => {
    const empty = await scanNpmDependencies({}, { lockfileVersion: 3, packages: { "": {} } }, async () => ({ results: [], errors: [], completedPackages: 0 }));
    expect(empty.status).toBe("COMPLETED");
    expect(empty.findings).toHaveLength(0);

    const manifest = { dependencies: { lodash: "^4.17.0" } };
    const lock = { lockfileVersion: 3, packages: { "": { dependencies: { lodash: "^4.17.0" } }, "node_modules/lodash": { version: "4.17.20" } } };
    const failed = await scanNpmDependencies(manifest, lock, async () => ({ results: [], errors: ["OSV offline"], completedPackages: 0 }));
    expect(failed.status).toBe("FAILED");
    expect(failed.warnings[0]?.code).toBe("OSV_API_ERROR");
  });

  it("marks partial source coverage Incomplete and stores structured audit evidence", async () => {
    const manifest = { dependencies: { lodash: "^4.17.0", minimist: "^1.0.0" } };
    const lock = { lockfileVersion: 3, packages: {
      "": { dependencies: manifest.dependencies },
      "node_modules/lodash": { version: "4.17.20" },
      "node_modules/minimist": { version: "1.2.5" },
    } };
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const incomplete = await scanNpmDependencies(manifest, lock, async () => ({ results: [], errors: [], completedPackages: 1 }));

    expect(incomplete.status).toBe("INCOMPLETE");
    expect(incomplete.warnings.map((warning) => warning.code)).toContain("OSV_INCOMPLETE_COVERAGE");
    expect(incomplete.auditTrail.some((event) => event.stage === "osv_query" && event.status === "INCOMPLETE")).toBe(true);
    expect(incomplete.auditTrail.every((event) => event.scan_id === "scan-unassigned" && event.timestamp)).toBe(true);
  });
});

describe("npm and OSV version matching", () => {
  it("matches common npm caret, tilde, comparator, wildcard, and OR ranges", () => {
    expect(matchesNpmRange("1.8.1", "^1.2.0")).toBe(true);
    expect(matchesNpmRange("2.0.0", "^1.2.0")).toBe(false);
    expect(matchesNpmRange("1.2.9", "~1.2.3")).toBe(true);
    expect(matchesNpmRange("1.3.0", "~1.2.3")).toBe(false);
    expect(matchesNpmRange("1.5.0", ">=1 <2")).toBe(true);
    expect(matchesNpmRange("4.17.20", ">= 4.17.21")).toBe(false);
    expect(matchesNpmRange("1.5.0", "1.x || 3.x")).toBe(true);
    expect(matchesNpmRange("3.1.0", "1.x || 3.x")).toBe(true);
    expect(matchesNpmRange("1.0.0-beta.1", "*")).toBe(false);
  });

  it("uses npm prerelease exclusion and strict SemVer parsing", () => {
    expect(matchesNpmRange("1.2.3-beta.1", ">=1.2.3 <2.0.0")).toBe(false);
    expect(matchesNpmRange("1.2.3-beta.1", ">=1.2.3-beta.0 <2.0.0")).toBe(true);
    expect(matchesNpmRange("1.2.3+invalid!metadata", "*")).toBeNull();
  });

  it("honors inclusive introduced, exclusive fixed, and inclusive last_affected boundaries", () => {
    expect(isOsvVersionAffected("1.0.0", [{ type: "SEMVER", events: [{ introduced: "1.0.0" }, { fixed: "1.2.0" }] }])).toBe(true);
    expect(isOsvVersionAffected("1.2.0", [{ type: "SEMVER", events: [{ introduced: "1.0.0" }, { fixed: "1.2.0" }] }])).toBe(false);
    expect(isOsvVersionAffected("2.0.0", [{ type: "SEMVER", events: [{ introduced: "1.0.0" }, { last_affected: "2.0.0" }] }])).toBe(true);
    expect(isOsvVersionAffected("2.0.1", [{ type: "SEMVER", events: [{ introduced: "1.0.0" }, { last_affected: "2.0.0" }] }])).toBe(false);
    expect(isOsvVersionAffected("1.5.0", [{ type: "SEMVER", events: [{ introduced: "1.0.0" }, { limit: "*" }] }])).toBe(true);
    expect(isOsvVersionAffected("1.5.0", [{ type: "ECOSYSTEM", events: [{ introduced: "1.0.0" }, { fixed: "2.0.0" }] }])).toBe(true);
  });

  it("returns unknown for ranges it cannot safely evaluate", () => {
    expect(matchesNpmRange("1.2.3", "git+https://github.com/example/repo" )).toBeNull();
    expect(isOsvVersionAffected("1.2.3", [{ type: "GIT", events: [{ introduced: "abc" }] }])).toBeNull();
  });
});

describe("deterministic npm SemVer property checks", () => {
  it("agrees with npm's semver evaluator across stable and prerelease versions", () => {
    const npmSemver = createRequire(import.meta.url)("semver") as {
      satisfies(version: string, range: string, options?: { includePrerelease?: boolean }): boolean;
    };
    const versions = [
      "0.0.0", "0.0.1", "0.2.3", "0.2.3-beta.1", "0.3.0", "1.0.0", "1.2.3",
      "1.2.3-alpha.1", "1.2.3-beta.10", "1.2.4", "1.9.9", "2.0.0", "2.0.0-rc.1",
      "2.3.4", "2.4.0", "3.0.0", "3.1.0+build.5",
    ];
    const ranges = [
      "", "*", "x", "1", "1.2", "1.x", "1.2.x", "^0.2.3", "^1.2.3", "~1.2.3",
      ">1", ">=1.2.3 <2.0.0", "<=1.2.x", "1.2.3 - 2.3", "1.2.3 || 3.x",
      ">=1.2.3-beta.1 <1.2.3", "^1.2.3-beta.1", "=1.2.3", "1.2.3+ignored-build",
    ];

    for (const version of versions) {
      for (const range of ranges) {
        expect(matchesNpmRange(version, range), `${version} against ${range}`).toBe(npmSemver.satisfies(version, range));
      }
    }
  });

  it("agrees with npm semver on a reproducible generated version/range sample", () => {
    const npmSemver = createRequire(import.meta.url)("semver") as {
      satisfies(version: string, range: string): boolean;
    };
    let seed = 0x5eedc0de;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    for (let index = 0; index < 120; index += 1) {
      const major = Math.floor(next() * 5);
      const minor = Math.floor(next() * 15);
      const patch = Math.floor(next() * 20);
      const version = `${major}.${minor}.${patch}${index % 9 === 0 ? `-beta.${Math.floor(next() * 4) + 1}` : ""}`;
      const ranges = [`^${major}.${minor}.${patch}`, `~${major}.${minor}.${patch}`, `>=${major}.${minor}.${patch} <${major + 1}.0.0`, `${major}.x`];
      for (const range of ranges) {
        expect(matchesNpmRange(version, range), `${version} against generated ${range}`).toBe(npmSemver.satisfies(version, range));
      }
    }
  });
});
