import { randomBytes, randomUUID } from "node:crypto";
import "server-only";

import { scanNpmDependencies } from "./npm-scanner";
import { saveDependencyScan } from "./scan-repository";
import { readNpmScanUpload } from "./upload";
import { compareDependencyScans } from "./verification";
import type { DependencyScanReport } from "./types";

export async function runUploadedNpmScan(request: Request, previous?: DependencyScanReport): Promise<{
  report: DependencyScanReport;
  accessToken: string;
}> {
  const { manifest, lock } = await readNpmScanUpload(request);
  const scanId = randomUUID();
  const scanned = await scanNpmDependencies(manifest, lock, undefined, undefined, undefined, scanId);
  const accessToken = randomBytes(32).toString("hex");
  const parentScanId = previous?.scanId ?? null;
  const report: DependencyScanReport = {
    ...scanned,
    scanId,
    parentScanId,
    scannedAt: new Date().toISOString(),
  };
  const comparedReport = previous ? compareDependencyScans(previous, report) : report;
  saveDependencyScan(comparedReport, accessToken);
  return { report: comparedReport, accessToken };
}
