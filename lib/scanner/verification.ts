import type { DependencyFinding, DependencyScanReport } from "./types";

/** Compare scans without treating an inconclusive/missing result as proof of remediation. */
export function compareDependencyScans(
  previous: DependencyScanReport,
  current: DependencyScanReport
): DependencyScanReport {
  const sameProject = Boolean(previous.scope.projectName && current.scope.projectName && previous.scope.projectName === current.scope.projectName);
  const priorFindings = previous.findings.filter((finding) => finding.verificationStatus !== "RESOLVED");
  const matchedPrevious = new Set<DependencyFinding>();
  const currentFindings = current.findings.map((finding) => {
    const prior = priorFindings.find((candidate) => sameFinding(candidate, finding));
    if (!prior) return { ...finding, verificationStatus: "UNVERIFIED" as const };
    matchedPrevious.add(prior);
    return {
      ...finding,
      verificationStatus: sameProject && current.status === "COMPLETED" && prior.matchStatus === "CONFIRMED" && prior.currentDetected && prior.sourceConflicts.length === 0 && finding.sourceConflicts.length === 0 && finding.matchStatus === "CONFIRMED"
        ? "STILL_DETECTED" as const
        : "UNVERIFIED" as const,
      previousVersion: prior.version,
    };
  });

  const absentFromLatest = priorFindings.filter((finding) => !matchedPrevious.has(finding)).map((finding) => {
    const currentPackage = current.packages.find((item) => item.name === finding.packageName &&
      item.locations.some((location) => finding.locations.includes(location)));
    const definitive = sameProject && current.status === "COMPLETED" && Boolean(currentPackage) && finding.currentDetected && finding.matchStatus === "CONFIRMED" && finding.sourceConflicts.length === 0;
    return {
      ...finding,
      version: currentPackage?.version ?? finding.version,
      previousVersion: finding.version,
      currentDetected: false,
      verificationStatus: definitive ? "RESOLVED" as const : "UNVERIFIED" as const,
      sourceConflicts: definitive
        ? finding.sourceConflicts
        : [...finding.sourceConflicts, "Pemindaian terbaru tidak lengkap; status perbaikan belum dapat diverifikasi."],
    };
  });

  return { ...current, findings: [...currentFindings, ...absentFromLatest] };
}

function sameFinding(left: DependencyFinding, right: DependencyFinding): boolean {
  return left.cveId === right.cveId && left.packageName === right.packageName &&
    left.locations.some((location) => right.locations.includes(location));
}
