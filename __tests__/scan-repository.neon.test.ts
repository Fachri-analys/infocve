import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

import { getAuthorizedDependencyScanPersistent, pruneExpiredScans, saveDependencyScan } from "@/lib/scanner/scan-repository";
import type { DependencyScanReport } from "@/lib/scanner/types";

const databaseUrl = process.env.TEST_DATABASE_URL;
const sql = databaseUrl ? neon(databaseUrl) : null;
const previousDatabaseUrl = process.env.DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const testIds: [string, string, string] = [randomUUID(), randomUUID(), randomUUID()];

describe.skipIf(!databaseUrl)("Neon scan repository integration", () => {
  const accessToken = `neon-integration-${randomUUID()}`;
  const now = new Date();

  it("persists scan history, enforces the access capability, links rescans, and prunes expired rows", async () => {
    const original = makeReport(testIds[0], null, now.toISOString());
    const rescan = makeReport(testIds[1], original.scanId, new Date(now.getTime() + 1_000).toISOString());
    const expired = makeReport(testIds[2], null, new Date(now.getTime() - 2 * 24 * 60 * 60 * 1_000).toISOString());

    await saveDependencyScan(original, accessToken);
    await saveDependencyScan(rescan, accessToken);
    await saveDependencyScan(expired, accessToken);

    await expect(getAuthorizedDependencyScanPersistent(original.scanId, accessToken)).resolves.toMatchObject({
      scanId: original.scanId,
      status: "COMPLETED_WITH_WARNINGS",
      findings: [],
      scope: { ecosystem: "npm", projectName: "neon-integration" },
    });
    await expect(getAuthorizedDependencyScanPersistent(original.scanId, "wrong-capability-token")).resolves.toBeNull();
    await expect(getAuthorizedDependencyScanPersistent(rescan.scanId, accessToken)).resolves.toMatchObject({
      scanId: rescan.scanId,
      parentScanId: original.scanId,
    });
    await expect(getAuthorizedDependencyScanPersistent(expired.scanId, accessToken)).resolves.not.toBeNull();

    expect(await pruneExpiredScans(1)).toBeGreaterThanOrEqual(1);
    await expect(getAuthorizedDependencyScanPersistent(expired.scanId, accessToken)).resolves.toBeNull();
    await expect(getAuthorizedDependencyScanPersistent(rescan.scanId, accessToken)).resolves.toMatchObject({
      scanId: rescan.scanId,
      parentScanId: original.scanId,
    });

    const rows = await sql!.query("SELECT access_token_hash FROM dependency_scans WHERE id = $1", [original.scanId]) as Array<{ access_token_hash: string }>;
    expect(rows[0]?.access_token_hash).not.toContain(accessToken);
  });
});

afterAll(async () => {
  try {
    if (sql) await sql.query("DELETE FROM dependency_scans WHERE id = ANY($1::text[])", [testIds]).catch(() => []);
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

function makeReport(scanId: string, parentScanId: string | null, scannedAt: string): DependencyScanReport {
  return {
    scanId,
    parentScanId,
    scannedAt,
    status: "COMPLETED_WITH_WARNINGS",
    scope: {
      ecosystem: "npm",
      projectName: "neon-integration",
      lockfileVersion: 3,
      packageCount: 1,
      directCount: 1,
      transitiveCount: 0,
      dataSources: ["OSV.dev"],
    },
    packages: [],
    findings: [],
    packageSummaries: [],
    warnings: [],
    limitations: ["Integration test record."],
    auditTrail: [],
    sourceAttributions: [],
  };
}
