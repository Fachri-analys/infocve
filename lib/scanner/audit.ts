import type { ScanAuditEvent } from "./types";

/** Emit JSON with an allow-list schema; raw fetch errors, request headers, and upload content are never accepted. */
export function logScannerAuditEvent(event: ScanAuditEvent, write: (json: string) => void = (json) => console.info(json)): void {
  write(JSON.stringify(sanitizeAuditEvent(event)));
}

export function sanitizeAuditEvent(event: ScanAuditEvent): ScanAuditEvent {
  const safe: Record<string, string | number> = {
    scan_id: short(event.scan_id, 80),
    timestamp: short(event.timestamp, 40),
    stage: short(event.stage, 64),
    status: short(event.status, 48),
  };
  const optional: Array<keyof Omit<ScanAuditEvent, "scan_id" | "timestamp" | "stage" | "status">> = [
    "package", "version", "cve", "affected_range", "source", "decision", "reason", "retry", "api_error", "duration_ms",
  ];
  for (const key of optional) {
    const value = event[key];
    if (typeof value === "number" && Number.isFinite(value)) Object.assign(safe, { [key]: Math.max(0, Math.min(value, 86_400_000)) });
    else if (typeof value === "string") Object.assign(safe, { [key]: redact(value, key === "reason" ? 300 : 200) });
  }
  return safe as unknown as ScanAuditEvent;
}

function short(value: string, max: number): string {
  return redact(value, max);
}

function redact(value: string, max: number): string {
  return value
    .replace(/[\r\n\t\0-\x1f\x7f]/g, " ")
    .replace(/\bauthorization\s*[:=]\s*(?:bearer\s+)?[^\s,;]+/gi, "authorization=[REDACTED]")
    .replace(/\b(?:api[_-]?key|token|secret)\s*[:=]\s*[^\s,;]+/gi, "[REDACTED]")
    .replace(/\bbearer\s+[^\s,;]+/gi, "[REDACTED]")
    .slice(0, max);
}
