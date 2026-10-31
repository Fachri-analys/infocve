import "server-only";

import { calculatePriority } from "@/lib/priority";
import { CveRepository } from "@/lib/db/cve-repository";
import type { CVE, PriorityAssessment, Severity } from "@/types/cve";
import { isSafeUrl } from "@/lib/security";
import { logScannerAuditEvent, sanitizeAuditEvent } from "./audit";
import { queryGithubAdvisories, type GithubAdvisory, type GithubAdvisoryResult } from "./github-advisory-client";
import { packageKey, queryOsvPackages, type OsvAffected, type OsvQueryResult, type OsvVulnerability } from "./osv-client";
import { parseNpmLock, type NpmInventory, type PackageJsonShape, type PackageLockShape } from "./npm-manifest";
import { compareSemver, isOsvVersionAffected, matchesNpmRange } from "./npm-semver";
import { npmPurlMatches } from "./npm-purl";
import type { DependencyFinding, DependencyScanReport, MatchStatus, ScanAuditEvent, ScanPackage, ScanWarning, SourceEvidence } from "./types";

export type LocalCveLookup = (cveId: string) => CVE | null;
export type OsvPackageQuery = (packages: NpmInventory["packages"]) => Promise<OsvQueryResult>;
export type GithubAdvisoryQuery = (ids: string[]) => Promise<GithubAdvisoryResult>;

const CVE_ID_PATTERN = /^CVE-\d{4}-\d{4,}$/i;
const SCAN_LIMITATIONS = [
  "Pemindaian memeriksa metadata dependency statis dari package.json dan package-lock.json; kode aplikasi tidak dijalankan.",
  "Pencocokan advisori menggunakan OSV.dev dan hanya melaporkan advisory yang memiliki alias CVE.",
  "Data yang tidak lengkap, rentang versi yang tidak dapat dipastikan, atau konflik sumber menghasilkan Needs Review atau Unverified.",
  "Hasil scanner tidak membuktikan aplikasi sepenuhnya aman dan tidak menggantikan pengujian keamanan atau pemeriksaan runtime.",
];

export async function scanNpmDependencies(
  manifest: PackageJsonShape,
  lock: PackageLockShape,
  query: OsvPackageQuery = queryOsvPackages,
  lookupCve: LocalCveLookup = (id) => {
    try { return CveRepository.getById(id); } catch { return null; }
  },
  queryGithub: GithubAdvisoryQuery = queryGithubAdvisories,
  scanId = "scan-unassigned"
): Promise<Omit<DependencyScanReport, "scanId" | "parentScanId" | "scannedAt">> {
  const auditTrail: ScanAuditEvent[] = [];
  const audit = (event: Omit<ScanAuditEvent, "scan_id" | "timestamp">) => {
    const completeEvent = sanitizeAuditEvent({ scan_id: scanId, timestamp: new Date().toISOString(), ...event } as ScanAuditEvent);
    auditTrail.push(completeEvent);
    logScannerAuditEvent(completeEvent);
  };
  const inventoryStartedAt = Date.now();
  const inventory = parseNpmLock(manifest, lock);
  const packages = inventory.packages.map(toScanPackage);
  const warnings: ScanWarning[] = inventory.warnings.map((warning) => ({ ...warning }));
  audit({ stage: "inventory", status: inventory.complete ? "COMPLETED" : "INCOMPLETE", decision: "PACKAGE_INVENTORY_PARSED", reason: `${inventory.packages.length} unique name/version records; ${inventory.warnings.length} inventory warnings.`, duration_ms: Date.now() - inventoryStartedAt });
  let osvResult: OsvQueryResult = { results: [], errors: [], completedPackages: 0 };
  const osvStartedAt = Date.now();
  if (inventory.packages.length > 0) {
    try {
      osvResult = await query(inventory.packages);
    } catch {
      osvResult.errors.push("OSV tidak dapat menyelesaikan permintaan pemindaian.");
    }
  }
  warnings.push(...osvResult.errors.map((message) => ({ code: "OSV_API_ERROR", message })));
  const expectedOsvPackages = new Set(inventory.packages.map(packageKey)).size;
  const osvCoverageComplete = osvResult.completedPackages >= expectedOsvPackages && osvResult.errors.length === 0;
  if (inventory.packages.length > 0 && osvResult.completedPackages < expectedOsvPackages) {
    warnings.push({ code: "OSV_INCOMPLETE_COVERAGE", message: `OSV menyelesaikan ${osvResult.completedPackages} dari ${expectedOsvPackages} pencarian paket.` });
  }
  if ((osvResult.retryCount ?? 0) > 0) audit({ stage: "retry", source: "OSV", status: "RETRIED", decision: "TRANSIENT_RETRY", reason: "OSV API mengalami kegagalan sementara dan permintaan diulang secara terbatas.", retry: osvResult.retryCount });
  audit({ stage: "osv_query", source: "OSV", status: osvCoverageComplete ? "COMPLETED" : "INCOMPLETE", decision: "SOURCE_QUERY_FINISHED", reason: `Completed ${osvResult.completedPackages}/${expectedOsvPackages} package queries.`, api_error: osvResult.errors.length ? osvResult.errors.join(" | ") : undefined, duration_ms: Date.now() - osvStartedAt });

  const ghsaIds = Array.from(new Set(osvResult.results.flatMap((result) => result.vulnerabilities.flatMap((advisory) =>
    [advisory.id, ...(advisory.aliases ?? [])].filter((id) => /^GHSA-[23456789CFGHJMPQRVWX]{4}-[23456789CFGHJMPQRVWX]{4}-[23456789CFGHJMPQRVWX]{4}$/i.test(id))
  ))));
  let githubResult: GithubAdvisoryResult = { advisories: new Map(), errors: [], attempts: new Map() };
  const ghsaStartedAt = Date.now();
  if (ghsaIds.length > 0) {
    try {
      githubResult = await queryGithub(ghsaIds);
    } catch {
      githubResult.errors.push("GitHub Security Advisories tidak dapat menyelesaikan permintaan pemindaian.");
    }
    warnings.push(...githubResult.errors.map((message) => ({ code: "GHSA_API_ERROR", message })));
  }
  for (const [id, attempts] of githubResult.attempts) {
    if (attempts > 1) audit({ stage: "retry", source: "GITHUB_SECURITY_ADVISORIES", status: "RETRIED", decision: "TRANSIENT_RETRY", reason: "A transient GitHub API response triggered a bounded retry.", retry: attempts });
    if (githubResult.advisories.has(id)) audit({ stage: "advisory_fetch", source: "GITHUB_SECURITY_ADVISORIES", status: "COMPLETED", cve: githubResult.advisories.get(id)?.cveId ?? undefined, decision: "ADVISORY_RETRIEVED", reason: `Retrieved ${id}.` });
  }
  audit({ stage: "github_advisory_query", source: "GITHUB_SECURITY_ADVISORIES", status: githubResult.errors.length === 0 ? "COMPLETED" : "INCOMPLETE", decision: ghsaIds.length ? "CROSS_CHECK_FINISHED" : "NO_GHSA_IDENTIFIERS", reason: `${githubResult.advisories.size}/${ghsaIds.length} advisory records retrieved.`, api_error: githubResult.errors.length ? githubResult.errors.join(" | ") : undefined, duration_ms: Date.now() - ghsaStartedAt });

  const findings = createNpmFindings(inventory.packages, osvResult, lookupCve, warnings, githubResult.advisories);
  const sourceAttributions = buildReportSourceAttributions(inventory.packages.length > 0, ghsaIds.length > 0, findings);
  for (const warning of warnings.filter((item) => item.code === "OSV_ADVISORY_NO_CVE")) {
    audit({ stage: "matching", source: "OSV", status: "UNVERIFIED", package: warning.packageName, decision: "ADVISORY_WITHOUT_CVE_ALIAS", reason: warning.message });
  }
  for (const finding of findings) {
    if (finding.matchStatus !== "CONFIRMED" && !warnings.some((warning) => warning.code === `MATCH_${finding.matchStatus}` && warning.cveId === finding.cveId && warning.packageName === finding.packageName)) {
      warnings.push({ code: `MATCH_${finding.matchStatus}`, packageName: finding.packageName, cveId: finding.cveId, message: `${finding.cveId} untuk ${finding.packageName}@${finding.version} berstatus ${finding.matchStatus}; baca bukti sumber sebelum mengambil tindakan.` });
    }
    audit({ stage: "matching", status: finding.matchStatus, package: finding.packageName, version: finding.version, cve: finding.cveId, decision: finding.currentDetected ? "POTENTIALLY_AFFECTED" : "CANDIDATE_NOT_CONFIRMED", reason: finding.sourceConflicts.length ? "Conflicting source evidence requires review." : `${finding.sourceEvidence.filter((item) => item.evaluation === "AFFECTED").length} sources marked affected.`, source: finding.sourceEvidence.map((item) => item.source).join(",") });
    for (const evidence of finding.sourceEvidence) audit({ stage: "source_evaluation", status: evidence.evaluation, package: finding.packageName, version: finding.version, cve: finding.cveId, affected_range: evidence.affectedRanges.join("; "), source: evidence.source, decision: evidence.evaluation, reason: evidence.reason });
  }
  for (const item of inventory.packages) {
    if (!findings.some((finding) => finding.packageName === item.name && finding.version === item.version)) {
      audit({ stage: "matching", status: "NO_MATCH", package: item.name, version: item.version, decision: "NO_ADVISORY_RETURNED", reason: "No CVE candidate with exact npm package identity was returned by OSV." });
    }
  }
  const apiFailed = inventory.packages.length > 0 && osvResult.completedPackages === 0;
  const incomplete = !inventory.complete || !osvCoverageComplete || githubResult.errors.length > 0;
  const status = apiFailed
    ? "FAILED"
    : incomplete
      ? "INCOMPLETE"
      : warnings.length > 0 || findings.some((finding) => finding.matchStatus !== "CONFIRMED")
        ? "COMPLETED_WITH_WARNINGS"
        : "COMPLETED";
  audit({ stage: "scan", status, decision: "SCAN_FINALIZED", reason: `${packages.length} package records; ${findings.filter((finding) => finding.currentDetected).length} affected findings; ${warnings.length} warnings.` });

  return {
    status,
    scope: {
      ecosystem: "npm",
      projectName: manifest.name ?? lock.name ?? null,
      lockfileVersion: inventory.lockfileVersion,
      packageCount: packages.reduce((count, item) => count + item.locations.length, 0),
      directCount: inventory.packages.reduce((count, item) => count + item.locations.filter(isRootInstallPath).length, 0),
      transitiveCount: inventory.packages.reduce((count, item) => count + item.locations.filter((location) => !isRootInstallPath(location)).length, 0),
      dataSources: ["OSV.dev", "GitHub Security Advisories", "NVD / InfoCVE local snapshot", "advisory reference URLs (reference only)"],
    },
    packages,
    findings,
    warnings,
    limitations: SCAN_LIMITATIONS,
    auditTrail,
    sourceAttributions,
  };
}

function buildReportSourceAttributions(
  queriedOsv: boolean,
  queriedGhsa: boolean,
  findings: DependencyFinding[]
): NonNullable<DependencyScanReport["sourceAttributions"]> {
  const attributions: NonNullable<DependencyScanReport["sourceAttributions"]> = [];
  if (queriedOsv) attributions.push({
    sourceId: "OSV",
    sourceName: "OSV.dev aggregator",
    sourceUrl: "https://osv.dev",
    termsUrl: "https://google.github.io/osv.dev/data/",
    rightsNote: "Lisensi record mengikuti database asal dan harus diperiksa per advisori; tidak ada lisensi blanket untuk seluruh respons OSV.",
    rightsReviewStatus: "NEEDS_REVIEW",
  });
  const upstreamOsvUrls = new Set(findings.flatMap((finding) => finding.sourceEvidence
    .filter((item) => item.source === "OSV" && item.originUrl)
    .map((item) => item.originUrl!)));
  for (const url of upstreamOsvUrls) attributions.push({
    sourceId: "OSV",
    sourceName: "Asal record menurut metadata OSV",
    sourceUrl: url,
    termsUrl: "https://google.github.io/osv.dev/data/",
    rightsNote: "Ketentuan lisensi mengikuti penerbit record ini; tinjau halaman asal sebelum redistribusi konten.",
    rightsReviewStatus: "NEEDS_REVIEW",
  });
  if (queriedGhsa) attributions.push({
    sourceId: "GITHUB_SECURITY_ADVISORIES",
    sourceName: "GitHub Advisory Database",
    sourceUrl: "https://github.com/advisories",
    termsUrl: "https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#advisory-database",
    rightsNote: "Database berlisensi CC BY 4.0; pertahankan atribusi dan tautan record GHSA yang spesifik.",
    rightsReviewStatus: "TERMS_IDENTIFIED",
  });
  if (findings.some((finding) => finding.sourceEvidence.some((item) => item.source === "NVD"))) attributions.push({
    sourceId: "NVD",
    sourceName: "NVD / NIST",
    sourceUrl: "https://nvd.nist.gov",
    termsUrl: "https://nvd.nist.gov/developers/terms-of-use",
    additionalTermsUrl: "https://www.cve.org/Legal/TermsOfUse",
    rightsNote: "Ikuti ketentuan API NVD dan CVE Program; pertahankan copyright designation/lisensi MITRE dan periksa kontribusi pihak ketiga per record.",
    rightsReviewStatus: "NEEDS_REVIEW",
  });
  const vendorUrls = new Set(findings.flatMap((finding) => finding.sourceEvidence
    .filter((item) => item.source === "VENDOR_ADVISORY" && item.url)
    .map((item) => item.url!)));
  for (const url of vendorUrls) attributions.push({
    sourceId: "VENDOR_ADVISORY",
    sourceName: "Advisori penerbit/vendor",
    sourceUrl: url,
    termsUrl: null,
    rightsNote: "Ketentuan publisher belum ditinjau; report hanya menautkan sumber dan tidak menyatakan izin untuk menyalin isinya.",
    rightsReviewStatus: "NEEDS_REVIEW",
  });
  return attributions;
}

export function createNpmFindings(
  packages: NpmInventory["packages"],
  osvResult: OsvQueryResult,
  lookupCve: LocalCveLookup = () => null,
  warnings: ScanWarning[] = [],
  githubAdvisories: Map<string, GithubAdvisory> = new Map(),
  now = new Date().toISOString()
): DependencyFinding[] {
  const byPackage = new Map(osvResult.results.map((item) => [item.packageKey, item.vulnerabilities]));
  const findings = new Map<string, DependencyFinding>();
  const localCache = new Map<string, CVE | null>();

  for (const dependency of packages) {
    const advisories = (byPackage.get(packageKey(dependency)) ?? []).slice().sort((a, b) => a.id.localeCompare(b.id));
    for (const advisory of advisories) {
      const cveIds = Array.from(new Set([advisory.id, ...(advisory.aliases ?? [])]
        .filter((id) => CVE_ID_PATTERN.test(id))
        .map((id) => id.toUpperCase())));
      if (cveIds.length === 0) {
        warnings.push({ code: "OSV_ADVISORY_NO_CVE", packageName: dependency.name, message: `OSV mengembalikan advisori ${advisory.id} untuk ${dependency.name}@${dependency.version}, tetapi tidak ada alias CVE untuk dilaporkan atau dibandingkan.` });
        continue;
      }

      const identityEntries = (advisory.affected ?? []).filter((entry) =>
        entry.package?.ecosystem === "npm" && entry.package.name === dependency.name
      );
      if (identityEntries.length === 0) {
        warnings.push({
          code: "OSV_PACKAGE_IDENTITY_CONFLICT",
          packageName: dependency.name,
          cveId: cveIds[0],
          message: `${advisory.id} dikembalikan untuk ${dependency.name}@${dependency.version}, tetapi detail tidak mengonfirmasi ekosistem npm dan nama paket yang sama. Kandidat disimpan sebagai Unverified.`,
        });
      }

      const packageEntries = identityEntries.filter((entry) => {
        if (!entry.package?.purl) return true;
        if (npmPurlMatches(entry.package.purl, dependency.name, dependency.version) === true) return true;
        warnings.push({
          code: "OSV_PURL_IDENTITY_CONFLICT",
          packageName: dependency.name,
          message: `${advisory.id} mencantumkan PURL ${entry.package.purl} yang tidak mengidentifikasi ${dependency.name}@${dependency.version}.`,
        });
        return false;
      });

      const evaluations = packageEntries.map((entry) => ({ entry, result: isOsvVersionAffected(dependency.version, entry.ranges ?? [], entry.versions ?? []) }));
      const matches = evaluations.filter((evaluation) => evaluation.result === true);
      const unverifiable = matches.length === 0 && evaluations.some((evaluation) => evaluation.result === null);
      const conflictsWithQuery = packageEntries.length > 0 && matches.length === 0 && !unverifiable;
      if (unverifiable || conflictsWithQuery) {
        warnings.push({
          code: unverifiable ? "AFFECTED_RANGE_UNVERIFIABLE" : "OSV_QUERY_DETAIL_CONFLICT",
          packageName: dependency.name,
          cveId: cveIds[0],
          message: unverifiable
            ? `Rentang terdampak ${cveIds[0]} untuk ${dependency.name}@${dependency.version} tidak dapat diverifikasi.`
            : `Hasil query OSV dan data rentang ${cveIds[0]} untuk ${dependency.name}@${dependency.version} saling bertentangan.`,
        });
      }

      for (const cveId of cveIds) {
        const key = `${cveId}|${dependency.name}|${dependency.version}`;
        const localCve = getLocalCve(cveId, lookupCve, localCache);
        const evidence = buildSourceEvidence(cveId, dependency.name, dependency.version, advisory, identityEntries, packageEntries, githubAdvisories, localCve, now);
        const ghsaIds = getGhsaIds(advisory);
        const relatedGithub = ghsaIds.map((id) => githubAdvisories.get(id)).filter((item): item is GithubAdvisory => Boolean(item));
        const positives = evidence.filter((item) => item.evaluation === "AFFECTED");
        const negatives = evidence.filter((item) => item.evaluation === "NOT_AFFECTED");
        const positiveSources = new Set(positives.map((item) => item.source));
        const hasCrossSourceConflict = positives.some((positive) => negatives.some((negative) => positive.source !== negative.source));
        const currentDetected = positives.length > 0;
        const sourceConflicts: string[] = [];
        const osvMatchRanges = matches.flatMap((entry) => describeAffectedRanges(entry.entry));
        const ghsaMatchRanges = relatedGithub.flatMap((item) => item.vulnerabilities
          .filter((vulnerability) => vulnerability.package.ecosystem === "npm" && vulnerability.package.name === dependency.name &&
            (!vulnerability.package.purl || npmPurlMatches(vulnerability.package.purl, dependency.name, dependency.version) === true) &&
            matchesNpmRange(dependency.version, vulnerability.vulnerableVersionRange) === true)
          .map((vulnerability) => vulnerability.vulnerableVersionRange));
        const affectedRangeConflict = osvMatchRanges.length > 0 && ghsaMatchRanges.length > 0 &&
          !sameRangeSet(osvMatchRanges, ghsaMatchRanges);
        if (hasCrossSourceConflict) {
          sourceConflicts.push(`Sumber advisori memberi hasil versi yang bertentangan untuk ${cveId} pada ${dependency.name}@${dependency.version}.`);
        }
        if (affectedRangeConflict) sourceConflicts.push(`OSV dan GitHub Security Advisories memberi affected range berbeda untuk ${cveId}; kecocokan perlu ditinjau.`);
        if (conflictsWithQuery) sourceConflicts.push(`Query OSV mengembalikan ${cveId}, tetapi rentang detail OSV tidak mencakup ${dependency.name}@${dependency.version}.`);
        if (identityEntries.length === 0) sourceConflicts.push(`Detail OSV tidak mengonfirmasi identitas npm ${dependency.name}; kecocokan tidak dianggap terverifikasi.`);
        if (identityEntries.length > packageEntries.length) sourceConflicts.push(`PURL dalam detail OSV tidak cocok dengan package ${dependency.name}@${dependency.version}.`);
        const hasUnknownEvidence = evidence.some((item) => item.evaluation === "UNKNOWN" || item.evaluation === "IDENTITY_MISMATCH" ||
          ((item.source === "NVD" || item.source === "VENDOR_ADVISORY") && item.evaluation === "NOT_COMPARABLE"));
        let matchStatus: MatchStatus = sourceConflicts.length > 0
          ? "NEEDS_REVIEW"
          : hasUnknownEvidence ? (currentDetected ? "NEEDS_REVIEW" : "UNVERIFIED")
            : positiveSources.size >= 2 && !hasCrossSourceConflict ? "CONFIRMED"
              : positiveSources.size === 1 ? "NEEDS_REVIEW"
                : "UNVERIFIED";
        const osvFixedVersions = matches.flatMap((entry) => fixedVersionsFrom(entry.entry, dependency.version));
        const ghsaFixed = relatedGithub.flatMap((item) => item.vulnerabilities
          .filter((vulnerability) => vulnerability.package.ecosystem === "npm" && vulnerability.package.name === dependency.name && matchesNpmRange(dependency.version, vulnerability.vulnerableVersionRange) === true)
          .map((vulnerability) => vulnerability.firstPatchedVersion)
          .filter((version): version is string => Boolean(version) && compareSemver(version!, version!) !== null));
        if (osvFixedVersions.length > 0 && ghsaFixed.length > 0 && !osvFixedVersions.some((version) => ghsaFixed.includes(version))) {
          sourceConflicts.push(`OSV dan GitHub Security Advisories menyebut versi perbaikan berbeda untuk ${cveId}; rekomendasi upgrade otomatis ditahan.`);
          matchStatus = "NEEDS_REVIEW";
        }
        const allFixedVersions = Array.from(new Set([
          ...osvFixedVersions,
          ...ghsaFixed,
        ])).sort(compareVersions);
        const finding = findings.get(key) ?? createFinding(key, cveId, dependency, advisory, matches.map((entry) => entry.entry), localCve, currentDetected, matchStatus, evidence, sourceConflicts, allFixedVersions, relatedGithub);
        if (findings.has(key)) {
          const previouslyConfirmed = finding.matchStatus === "CONFIRMED";
          finding.currentDetected ||= currentDetected;
          finding.sourceEvidence = mergeEvidence(finding.sourceEvidence, evidence);
          for (const conflict of sourceConflicts) if (!finding.sourceConflicts.includes(conflict)) finding.sourceConflicts.push(conflict);
          finding.matchStatus = previouslyConfirmed && matchStatus === "CONFIRMED" && finding.sourceConflicts.length === 0
            ? "CONFIRMED"
            : finding.currentDetected ? "NEEDS_REVIEW" : "UNVERIFIED";
          for (const fixedVersion of allFixedVersions) if (!finding.fixedVersions.includes(fixedVersion)) finding.fixedVersions.push(fixedVersion);
          finding.fixedVersions.sort(compareVersions);
          finding.upgradeCommand = finding.fixedVersions[0] && finding.sourceConflicts.length === 0
            ? `npm install --save-exact ${dependency.name}@${finding.fixedVersions[0]}`
            : null;
          for (const github of relatedGithub) {
            const url = `https://github.com/advisories/${github.id}`;
            if (!finding.references.some((reference) => reference.url === url)) finding.references.push({ type: "GITHUB_SECURITY_ADVISORIES", url });
            for (const reference of github.references) if (!finding.references.some((candidate) => candidate.url === reference)) finding.references.push({ type: "VENDOR_ADVISORY", url: reference });
          }
        }
        finding.direct ||= dependency.direct;
        finding.transitive ||= dependency.transitive;
        for (const location of dependency.locations) if (!finding.locations.includes(location)) finding.locations.push(location);
        if (!finding.osvIds.includes(advisory.id)) finding.osvIds.push(advisory.id);
        if (advisory.summary && finding.summary && normalizeText(advisory.summary) !== normalizeText(finding.summary)) {
          const disagreement = `Ringkasan advisori OSV berbeda untuk ${cveId} (${finding.osvIds.join(", ")}).`;
          if (!finding.sourceConflicts.includes(disagreement)) finding.sourceConflicts.push(disagreement);
          finding.matchStatus = "NEEDS_REVIEW";
          finding.upgradeCommand = null;
          warnings.push({ code: "OSV_ADVISORY_CONFLICT", packageName: dependency.name, cveId, message: disagreement });
        }
        findings.set(key, finding);
      }
    }
  }
  for (const finding of findings.values()) {
    for (const conflict of finding.sourceConflicts) {
      if (!warnings.some((warning) => warning.code === "SOURCE_CONFLICT" && warning.cveId === finding.cveId && warning.message === conflict)) {
        warnings.push({ code: "SOURCE_CONFLICT", packageName: finding.packageName, cveId: finding.cveId, message: conflict });
      }
    }
  }
  return Array.from(findings.values()).sort((a, b) => a.priority.localeCompare(b.priority) || a.cveId.localeCompare(b.cveId));
}

function createFinding(
  key: string,
  cveId: string,
  dependency: NpmInventory["packages"][number],
  advisory: OsvVulnerability,
  matchedEntries: OsvAffected[],
  localCve: CVE | null,
  currentDetected: boolean,
  matchStatus: MatchStatus,
  sourceEvidence: SourceEvidence[],
  sourceConflicts: string[],
  fixedVersions: string[],
  githubAdvisories: GithubAdvisory[]
): DependencyFinding {
  let priorityAssessment: PriorityAssessment | undefined;
  let prioritySource = "OSV severity dipetakan dengan metodologi prioritas InfoCVE";
  if (localCve) {
    priorityAssessment = localCve.priority ?? calculatePriority(localCve);
    prioritySource = "CVSS, EPSS, dan CISA KEV dari NVD / InfoCVE";
  } else {
    const severity = getSourceSeverity(advisory, matchedEntries);
    priorityAssessment = calculatePriority({ cvss: { severity: severity ?? "NONE" } });
  }

  const refs = (advisory.references ?? [])
    .filter((reference) => isSafeUrl(reference.url))
    .map((reference) => ({ type: reference.type || "WEB", url: reference.url }));
  const references: DependencyFinding["references"] = [
    { type: "OSV", url: `https://osv.dev/vulnerability/${encodeURIComponent(advisory.id)}` },
    ...githubAdvisories.map((item) => ({ type: "GITHUB_SECURITY_ADVISORIES", url: item.url })),
    ...refs,
    ...(localCve ? [{ type: "NVD", url: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cveId)}` }] : []),
  ].filter((reference, index, list) => list.findIndex((candidate) => candidate.url === reference.url) === index);
  const advisoryReferences = refs.filter((reference) => reference.type === "ADVISORY");
  const affectedRanges = Array.from(new Set(matchedEntries.flatMap((entry) => describeAffectedRanges(entry))));
  for (const github of githubAdvisories) {
    for (const vulnerability of github.vulnerabilities) {
      if (vulnerability.package.ecosystem === "npm" && vulnerability.package.name === dependency.name && !affectedRanges.includes(vulnerability.vulnerableVersionRange)) affectedRanges.push(vulnerability.vulnerableVersionRange);
    }
  }
  fixedVersions = Array.from(new Set(fixedVersions)).sort(compareVersions);
  const bestFixedVersion = fixedVersions[0];
  const upgradeCommand = sourceConflicts.length === 0 && bestFixedVersion && compareSemver(bestFixedVersion, bestFixedVersion) !== null
    ? `npm install --save-exact ${dependency.name}@${bestFixedVersion}`
    : null;
  for (const github of githubAdvisories) for (const reference of github.references) {
    if (!references.some((item) => item.url === reference)) references.push({ type: "VENDOR_ADVISORY", url: reference });
  }
  const nvdReference = localCve?.references?.find((reference) => isSafeUrl(reference.url));
  if (nvdReference && !references.some((reference) => reference.url === nvdReference.url)) references.push({ type: "NVD_REFERENCE", url: nvdReference.url });

  return {
    key,
    cveId,
    osvIds: [advisory.id],
    packageName: dependency.name,
    version: dependency.version,
    direct: dependency.direct,
    transitive: dependency.transitive,
    locations: dependency.locations,
    priority: priorityAssessment.tier,
    prioritySource,
    priorityReasons: priorityAssessment.reasons,
    severity: getSourceSeverity(advisory, matchedEntries),
    summary: safeText(advisory.summary, 500),
    advisoryDetails: safeText(advisory.details, 15_000),
    affectedRanges,
    fixedVersions,
    upgradeCommand,
    temporaryMitigation: null,
    references,
    advisoryReferences,
    sourceConflicts,
    matchStatus,
    sourceEvidence,
    verificationStatus: "UNVERIFIED",
    currentDetected,
  };
}

function getLocalCve(cveId: string, lookup: LocalCveLookup, cache: Map<string, CVE | null>): CVE | null {
  if (cache.has(cveId)) return cache.get(cveId) ?? null;
  const cve = lookup(cveId);
  cache.set(cveId, cve);
  return cve;
}

function getGhsaIds(advisory: OsvVulnerability): string[] {
  return Array.from(new Set([advisory.id, ...(advisory.aliases ?? [])]
    .map((id) => id.toUpperCase())
    .filter((id) => /^GHSA-[23456789CFGHJMPQRVWX]{4}-[23456789CFGHJMPQRVWX]{4}-[23456789CFGHJMPQRVWX]{4}$/.test(id))));
}

function buildSourceEvidence(
  cveId: string,
  packageName: string,
  version: string,
  advisory: OsvVulnerability,
  identityEntries: OsvAffected[],
  packageEntries: OsvAffected[],
  githubAdvisories: Map<string, GithubAdvisory>,
  nvd: CVE | null,
  fetchedAt: string
): SourceEvidence[] {
  const evidence: SourceEvidence[] = [];
  const osvOriginUrl = typeof advisory.database_specific?.source === "string" && isSafeUrl(advisory.database_specific.source)
    ? advisory.database_specific.source
    : null;
  const dataRights = (source: SourceEvidence["source"]): Pick<SourceEvidence, "dataRightsNote" | "dataRightsUrl" | "rightsReviewStatus"> => {
    if (source === "OSV") return {
      rightsReviewStatus: "NEEDS_REVIEW",
      dataRightsNote: "OSV adalah agregator; lisensi mengikuti sumber asal record dan perlu diperiksa per advisori.",
      dataRightsUrl: "https://google.github.io/osv.dev/data/",
    };
    if (source === "GITHUB_SECURITY_ADVISORIES") return {
      rightsReviewStatus: "TERMS_IDENTIFIED",
      dataRightsNote: "GitHub Advisory Database CC BY 4.0; pertahankan atribusi dan tautan record spesifik.",
      dataRightsUrl: "https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#advisory-database",
    };
    if (source === "NVD") return {
      rightsReviewStatus: "NEEDS_REVIEW",
      dataRightsNote: "Ketentuan API NVD dan CVE Program berlaku; konten kontributor/pihak ketiga perlu ditinjau per record.",
      dataRightsUrl: "https://nvd.nist.gov/developers/terms-of-use",
    };
    return {
      rightsReviewStatus: "NEEDS_REVIEW",
      dataRightsNote: "Ketentuan ditentukan penerbit advisori; InfoCVE hanya mempertahankan tautan dan belum meninjau izin redistribusi konten.",
      dataRightsUrl: null,
    };
  };
  if (identityEntries.length === 0) {
      evidence.push({ source: "OSV", ...dataRights("OSV"), observationType: "ADVISORY_RESPONSE", advisoryId: advisory.id, url: `https://osv.dev/vulnerability/${encodeURIComponent(advisory.id)}`, originUrl: osvOriginUrl, fetchedAt: advisory.fetchedAt ?? fetchedAt, updatedAt: advisory.modified ?? null, packageName: null, ecosystem: null, affectedRanges: [], evaluation: "IDENTITY_MISMATCH", reason: "OSV mengembalikan kandidat, tetapi identitas paket detail tidak cocok persis dengan ekosistem npm dan nama package." });
  } else if (packageEntries.length === 0) {
    evidence.push({ source: "OSV", ...dataRights("OSV"), observationType: "ADVISORY_RESPONSE", advisoryId: advisory.id, url: `https://osv.dev/vulnerability/${encodeURIComponent(advisory.id)}`, originUrl: osvOriginUrl, fetchedAt: advisory.fetchedAt ?? fetchedAt, updatedAt: advisory.modified ?? null, packageName, ecosystem: "npm", affectedRanges: [], evaluation: "IDENTITY_MISMATCH", reason: "PURL OSV tidak mengidentifikasi package dan versi terpasang yang sama." });
  } else {
    for (const entry of packageEntries) {
      const result = isOsvVersionAffected(version, entry.ranges ?? [], entry.versions ?? []);
      evidence.push({
        source: "OSV", ...dataRights("OSV"), observationType: "ADVISORY_RESPONSE", advisoryId: advisory.id, url: `https://osv.dev/vulnerability/${encodeURIComponent(advisory.id)}`, originUrl: osvOriginUrl,
        fetchedAt: advisory.fetchedAt ?? fetchedAt, updatedAt: advisory.modified ?? null, packageName, ecosystem: entry.package?.ecosystem ?? null, purl: entry.package?.purl ?? null,
        affectedRanges: describeAffectedRanges(entry), evaluation: result === true ? "AFFECTED" : result === false ? "NOT_AFFECTED" : "UNKNOWN",
        reason: result === true ? "Ekosistem dan nama paket exact; SemVer terpasang berada dalam rentang OSV." : result === false ? "Identitas paket exact; SemVer terpasang berada di luar seluruh rentang OSV yang dapat dibandingkan." : "Identitas paket ditemukan, tetapi rentang OSV tidak dapat dievaluasi dengan aman sebagai npm SemVer.",
      });
    }
  }

  const ghsaIds = getGhsaIds(advisory);
  if (ghsaIds.length === 0) {
      evidence.push({ source: "GITHUB_SECURITY_ADVISORIES", ...dataRights("GITHUB_SECURITY_ADVISORIES"), observationType: "SOURCE_NOT_QUERIED", advisoryId: null, url: null, fetchedAt, packageName, ecosystem: "npm", affectedRanges: [], evaluation: "UNKNOWN", reason: "OSV tidak menyediakan GHSA ID untuk pembandingan langsung." });
  } else {
    for (const ghsaId of ghsaIds) {
      const ghsa = githubAdvisories.get(ghsaId);
      if (!ghsa) {
        evidence.push({ source: "GITHUB_SECURITY_ADVISORIES", ...dataRights("GITHUB_SECURITY_ADVISORIES"), observationType: "SOURCE_LOOKUP_NO_RECORD", advisoryId: ghsaId, url: `https://github.com/advisories/${ghsaId}`, fetchedAt, packageName, ecosystem: "npm", affectedRanges: [], evaluation: "UNKNOWN", reason: "GHSA ID terhubung dari OSV, tetapi record GHSA tidak tersedia pada waktu scan." });
        continue;
      }
      const cveMismatch = Boolean(ghsa.cveId && ghsa.cveId !== cveId);
      const matching = ghsa.vulnerabilities.filter((item) => item.package.ecosystem === "npm" && item.package.name === packageName);
      if (cveMismatch || matching.length === 0) {
        evidence.push({ source: "GITHUB_SECURITY_ADVISORIES", ...dataRights("GITHUB_SECURITY_ADVISORIES"), observationType: "ADVISORY_RESPONSE", advisoryId: ghsaId, url: ghsa.url, fetchedAt: ghsa.fetchedAt, updatedAt: ghsa.updatedAt, packageName, ecosystem: "npm", affectedRanges: [], evaluation: "IDENTITY_MISMATCH", reason: cveMismatch ? `GHSA mengaitkan CVE ${ghsa.cveId}, bukan ${cveId}.` : "GHSA tidak memiliki vulnerability record dengan ekosistem npm dan nama paket exact." });
        continue;
      }
      for (const item of matching) {
        const purlMatches = item.package.purl ? npmPurlMatches(item.package.purl, packageName, version) : true;
        const result = purlMatches ? matchesNpmRange(version, item.vulnerableVersionRange) : false;
        evidence.push({
          source: "GITHUB_SECURITY_ADVISORIES", ...dataRights("GITHUB_SECURITY_ADVISORIES"), observationType: "ADVISORY_RESPONSE", advisoryId: ghsaId, url: ghsa.url, fetchedAt: ghsa.fetchedAt, updatedAt: ghsa.updatedAt,
          packageName: item.package.name, ecosystem: item.package.ecosystem, purl: item.package.purl ?? null,
          affectedRanges: [item.vulnerableVersionRange], evaluation: !purlMatches ? "IDENTITY_MISMATCH" : result === true ? "AFFECTED" : result === false ? "NOT_AFFECTED" : "UNKNOWN",
          reason: !purlMatches ? "PURL GHSA tidak cocok dengan package/version terpasang." : result === true ? "GHSA mengonfirmasi package npm exact dan SemVer berada dalam vulnerable range." : result === false ? "Package exact, tetapi versi terpasang berada di luar vulnerable range GHSA." : "GHSA memberikan rentang yang tidak dapat dievaluasi sebagai npm SemVer.",
        });
      }
    }
  }

  if (!nvd) {
    evidence.push({ source: "NVD", ...dataRights("NVD"), observationType: "LOCAL_SNAPSHOT", advisoryId: cveId, url: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cveId)}`, fetchedAt, packageName, ecosystem: "npm", affectedRanges: [], evaluation: "UNKNOWN", reason: "CVE tidak tersedia pada snapshot lokal NVD/InfoCVE; pencocokan NVD tidak dilakukan pada scan ini." });
  } else {
    const matching = nvd.affected.filter((item) => item.product === packageName);
    if (matching.length === 0) {
      evidence.push({ source: "NVD", ...dataRights("NVD"), observationType: "LOCAL_SNAPSHOT", advisoryId: cveId, url: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cveId)}`, fetchedAt, updatedAt: nvd.lastModifiedDate, packageName: nvd.product, ecosystem: null, affectedRanges: [], evaluation: "NOT_COMPARABLE", reason: `Snapshot NVD tidak mencantumkan product dengan nama exact ${packageName}; CPE tidak dianggap sama hanya karena mirip.` });
    } else {
      const ranges = matching.flatMap((item) => item.versions);
      evidence.push({ source: "NVD", ...dataRights("NVD"), observationType: "LOCAL_SNAPSHOT", advisoryId: cveId, url: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cveId)}`, fetchedAt, updatedAt: nvd.lastModifiedDate, packageName, ecosystem: null, affectedRanges: ranges, evaluation: "NOT_COMPARABLE", reason: "Snapshot InfoCVE berasal dari NVD, tetapi data produk/CPE tidak menyertakan identitas ekosistem npm atau PURL. Nama/rentang produk NVD dicatat sebagai konteks dan tidak dipakai untuk memutuskan package npm." });
    }
  }

  const vendorUrls = new Set([
    ...(advisory.references ?? []).filter((reference) => reference.type === "ADVISORY").map((reference) => reference.url),
    ...ghsaIds.flatMap((id) => githubAdvisories.get(id)?.references ?? []),
    ...(nvd?.references ?? []).map((reference) => reference.url),
  ].filter((url) => {
    if (!isSafeUrl(url)) return false;
    const host = new URL(url).hostname.toLowerCase();
    return host !== "github.com" && !host.endsWith(".github.com") && host !== "osv.dev" && !host.endsWith(".osv.dev");
  }));
  for (const url of vendorUrls) evidence.push({ source: "VENDOR_ADVISORY", ...dataRights("VENDOR_ADVISORY"), observationType: "REFERENCE_ONLY", advisoryId: null, url, fetchedAt, packageName, ecosystem: "npm", affectedRanges: [], evaluation: "NOT_COMPARABLE", reason: "Sumber advisori menyediakan URL vendor; halaman tidak di-fetch/di-parse, sehingga ini bukti provenance saja dan bukan konfirmasi rentang versi." });
  return evidence;
}

function mergeEvidence(existing: SourceEvidence[], incoming: SourceEvidence[]): SourceEvidence[] {
  const merged = [...existing];
  for (const item of incoming) {
    const key = `${item.source}|${item.advisoryId}|${item.url}|${item.evaluation}|${item.affectedRanges.join(",")}`;
    if (!merged.some((candidate) => `${candidate.source}|${candidate.advisoryId}|${candidate.url}|${candidate.evaluation}|${candidate.affectedRanges.join(",")}` === key)) merged.push(item);
  }
  return merged;
}

function sameRangeSet(left: string[], right: string[]): boolean {
  const canonical = (ranges: string[]) => Array.from(new Set(ranges.map((range) => range
    .toLowerCase()
    .replace(/\bdan\b/g, " ")
    .replace(/[\s,]+/g, "")
  ))).sort();
  const leftSet = canonical(left);
  const rightSet = canonical(right);
  return leftSet.length === rightSet.length && leftSet.every((range, index) => range === rightSet[index]);
}

function getSourceSeverity(advisory: OsvVulnerability, entries: OsvAffected[]): Severity | null {
  const candidates: unknown[] = [
    ...entries.flatMap((entry) => entry.severity?.map((item) => item.score) ?? []),
    ...advisory.severity?.map((item) => item.score) ?? [],
    advisory.database_specific?.severity,
    ...entries.map((entry) => entry.database_specific?.severity),
    ...entries.map((entry) => entry.ecosystem_specific?.severity),
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const severity = candidate.toUpperCase();
    if (["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(severity)) return severity as Severity;
  }
  return null;
}

function describeAffectedRanges(entry: OsvAffected): string[] {
  const descriptions: string[] = [];
  for (const version of entry.versions ?? []) descriptions.push(version);
  for (const range of entry.ranges ?? []) {
    let start: string | undefined;
    for (const event of range.events) {
      if (event.introduced !== undefined) start = event.introduced;
      if (event.fixed !== undefined) {
        descriptions.push(`${start && start !== "0" ? `>= ${start} dan ` : ""}< ${event.fixed}`);
        start = undefined;
      } else if (event.last_affected !== undefined) {
        descriptions.push(`${start && start !== "0" ? `>= ${start} dan ` : ""}<= ${event.last_affected}`);
        start = undefined;
      } else if (event.limit !== undefined) {
        descriptions.push(`${start && start !== "0" ? `>= ${start} dan ` : ""}< ${event.limit}`);
        start = undefined;
      }
    }
    if (start !== undefined) descriptions.push(start === "0" ? "Sampai versi terbaru yang tersedia" : `>= ${start}`);
  }
  return descriptions;
}

function fixedVersionsFrom(entry: OsvAffected, installedVersion: string): string[] {
  const fixes: string[] = [];
  for (const range of entry.ranges ?? []) {
    let introduced: string | undefined;
    for (const event of range.events) {
      if (event.introduced !== undefined) introduced = event.introduced;
      if (event.fixed !== undefined) {
        const atOrAfterIntro = introduced === undefined || compareSemver(installedVersion, introduced) !== -1;
        const beforeFix = compareSemver(installedVersion, event.fixed) === -1;
        if (atOrAfterIntro && beforeFix && compareSemver(event.fixed, event.fixed) !== null) fixes.push(event.fixed);
        introduced = undefined;
      }
      if (event.last_affected !== undefined || event.limit !== undefined) introduced = undefined;
    }
  }
  return fixes;
}

function toScanPackage(item: NpmInventory["packages"][number]): ScanPackage {
  return { name: item.name, version: item.version, purl: item.purl, direct: item.direct, transitive: item.transitive, locations: item.locations };
}

function isRootInstallPath(location: string): boolean {
  return /^node_modules\/(?:@[^/]+\/)?[^/]+$/.test(location);
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function safeText(value: string | undefined, maxLength: number): string | null {
  if (!value?.trim()) return null;
  return value.trim().slice(0, maxLength);
}

function compareVersions(left: string, right: string): number {
  return compareSemver(left, right) ?? left.localeCompare(right);
}
