import { createHash, timingSafeEqual } from "node:crypto";
import "server-only";

import { getDb } from "@/lib/db";
import type { DependencyScanReport } from "./types";

export function saveDependencyScan(report: DependencyScanReport, accessToken: string): void {
  pruneExpiredScans();
  const db = getDb();
  db.prepare(`
    INSERT INTO dependency_scans (id, parent_scan_id, access_token_hash, scanned_at, status, report_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    report.scanId,
    report.parentScanId,
    hashToken(accessToken),
    report.scannedAt,
    report.status,
    JSON.stringify(report),
    new Date().toISOString()
  );
}

/** Scan IDs are public identifiers; the independent random token is the read capability. */
export function getAuthorizedDependencyScan(scanId: string, accessToken: string): DependencyScanReport | null {
  const db = getDb();
  const row = db.prepare("SELECT access_token_hash, report_json FROM dependency_scans WHERE id = ?").get(scanId) as
    | { access_token_hash: string; report_json: string }
    | undefined;
  if (!row || !tokenMatches(row.access_token_hash, accessToken)) return null;
  try {
    return normalizeStoredReport(JSON.parse(row.report_json));
  } catch {
    return null;
  }
}

function normalizeStoredReport(value: unknown): DependencyScanReport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const report = value as Partial<DependencyScanReport> & { status?: string; findings?: unknown[] };
  if (typeof report.scanId !== "string" || typeof report.scannedAt !== "string" || !report.scope || !Array.isArray(report.findings)) return null;
  const storedStatus = (value as { status?: string }).status;
  const status = storedStatus === "COMPLETE" ? "COMPLETED"
    : storedStatus === "PARTIAL" ? "INCOMPLETE"
      : storedStatus;
  if (!["COMPLETED", "COMPLETED_WITH_WARNINGS", "INCOMPLETE", "FAILED"].includes(status ?? "")) return null;
  return {
    ...report,
    status: status as DependencyScanReport["status"],
    auditTrail: Array.isArray(report.auditTrail) ? report.auditTrail : [],
    findings: report.findings.map((item) => {
      const finding = item as DependencyScanReport["findings"][number];
      return {
        ...finding,
        matchStatus: finding.matchStatus ?? "UNVERIFIED",
        sourceEvidence: Array.isArray(finding.sourceEvidence) ? finding.sourceEvidence : [],
      };
    }),
    packageSummaries: Array.isArray(report.packageSummaries) ? report.packageSummaries : undefined,
  } as DependencyScanReport;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokenMatches(storedHash: string, token: string): boolean {
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashToken(token), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Prunes scans older than the retention threshold.
 * Retention window defaults to 30 days and can be configured via DEPENDENCY_SCAN_RETENTION_DAYS.
 */
export function pruneExpiredScans(retentionDays?: number): number {
  try {
    const envDays = parseInt(process.env.DEPENDENCY_SCAN_RETENTION_DAYS || "", 10);
    const days = typeof retentionDays === "number" && retentionDays > 0
      ? retentionDays
      : Number.isFinite(envDays) && envDays > 0
        ? envDays
        : 30;

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const db = getDb();
    db.prepare(`
      DELETE FROM dependency_scans
      WHERE parent_scan_id IN (SELECT id FROM dependency_scans WHERE scanned_at < ?)
    `).run(cutoff);
    const res = db.prepare(`DELETE FROM dependency_scans WHERE scanned_at < ?`).run(cutoff);
    return Number(res.changes);
  } catch {
    return 0;
  }
}

