import { createHash, timingSafeEqual } from "node:crypto";
import "server-only";
import { neon } from "@neondatabase/serverless";

import { getDb } from "@/lib/db";
import type { DependencyScanReport } from "./types";

let neonClient: ReturnType<typeof neon> | null = null;
let neonSchemaReady: Promise<void> | null = null;

export async function saveDependencyScan(report: DependencyScanReport, accessToken: string): Promise<void> {
  if (getConnectionString()) {
    const sql = getNeonClient();
    await ensureNeonSchema(sql);
    await sql.query(`
      INSERT INTO dependency_scans (id, parent_scan_id, access_token_hash, scanned_at, status, report_json, created_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
    `, [report.scanId, report.parentScanId, hashToken(accessToken), report.scannedAt, report.status, JSON.stringify(report), new Date().toISOString()]);
    return;
  }

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
  return parseAuthorizedRow(row, accessToken);
}

export async function getAuthorizedDependencyScanPersistent(scanId: string, accessToken: string): Promise<DependencyScanReport | null> {
  if (!getConnectionString()) return getAuthorizedDependencyScan(scanId, accessToken);
  let row: { access_token_hash: string; report_json: string } | undefined;
  {
    const sql = getNeonClient();
    await ensureNeonSchema(sql);
    const rows = await sql.query(
      "SELECT access_token_hash, report_json::text AS report_json FROM dependency_scans WHERE id = $1 LIMIT 1",
      [scanId]
    ) as Array<{ access_token_hash: string; report_json: string }>;
    row = rows[0];
  }
  return parseAuthorizedRow(row, accessToken);
}

function parseAuthorizedRow(row: { access_token_hash: string; report_json: string } | undefined, accessToken: string): DependencyScanReport | null {
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

/** Prune old scans. Errors are best-effort here; reads and writes still report their own database errors. */
export async function pruneExpiredScans(retentionDays?: number): Promise<number> {
  const envDays = parseInt(process.env.DEPENDENCY_SCAN_RETENTION_DAYS || "", 10);
  const days = typeof retentionDays === "number" && retentionDays > 0
    ? retentionDays
    : Number.isFinite(envDays) && envDays > 0
      ? envDays
      : 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  if (getConnectionString()) {
    const sql = getNeonClient();
    await ensureNeonSchema(sql);
    const deleted = await sql.query("DELETE FROM dependency_scans WHERE scanned_at < $1 RETURNING id", [cutoff]) as Array<{ id: string }>;
    return deleted.length;
  }
  return pruneExpiredScansSqlite(cutoff);
}

function pruneExpiredScansSqlite(cutoff?: string): number {
  try {
    const envDays = parseInt(process.env.DEPENDENCY_SCAN_RETENTION_DAYS || "", 10);
    const days = Number.isFinite(envDays) && envDays > 0 ? envDays : 30;
    const expiry = cutoff ?? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const db = getDb();
    db.prepare(`DELETE FROM dependency_scans WHERE parent_scan_id IN (SELECT id FROM dependency_scans WHERE scanned_at < ?)`)
      .run(expiry);
    const result = db.prepare("DELETE FROM dependency_scans WHERE scanned_at < ?").run(expiry);
    return Number(result.changes);
  } catch {
    return 0;
  }
}

function getConnectionString(): string | null {
  return process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim() || null;
}

function getNeonClient() {
  const connectionString = getConnectionString();
  if (!connectionString) throw new Error("DATABASE_URL or POSTGRES_URL is required for persistent scanner storage.");
  if (!neonClient) neonClient = neon(connectionString);
  return neonClient;
}

async function ensureNeonSchema(sql: ReturnType<typeof neon>): Promise<void> {
  if (!neonSchemaReady) {
    neonSchemaReady = (async () => {
      await sql.query(`
        CREATE TABLE IF NOT EXISTS dependency_scans (
          id TEXT PRIMARY KEY,
          parent_scan_id TEXT REFERENCES dependency_scans(id) ON DELETE CASCADE,
          access_token_hash TEXT NOT NULL,
          scanned_at TIMESTAMPTZ NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('COMPLETED', 'COMPLETED_WITH_WARNINGS', 'INCOMPLETE', 'FAILED')),
          report_json JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL
        )
      `);
      await sql.query("CREATE INDEX IF NOT EXISTS idx_dependency_scans_parent ON dependency_scans (parent_scan_id, scanned_at DESC)");
      await sql.query("CREATE INDEX IF NOT EXISTS idx_dependency_scans_scanned_at ON dependency_scans (scanned_at)");
    })().catch((error) => {
      neonSchemaReady = null;
      throw error;
    });
  }
  await neonSchemaReady;
}
