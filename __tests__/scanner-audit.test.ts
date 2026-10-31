import { describe, expect, it } from "vitest";
import { logScannerAuditEvent, sanitizeAuditEvent } from "@/lib/scanner/audit";

describe("scanner structured audit logging", () => {
  it("emits JSON with bounded, allow-listed fields and redacts credentials", () => {
    const writes: string[] = [];
    logScannerAuditEvent({
      scan_id: "scan-123", timestamp: "2026-10-31T00:00:00.000Z", stage: "osv_query", status: "INCOMPLETE",
      package: "lodash", version: "4.17.20", cve: "CVE-2021-23337", source: "OSV",
      decision: "API_ERROR", api_error: "API_KEY=ultra-secret", reason: "Authorization: Bearer hidden-token\nretry required", retry: 2,
    }, (json) => writes.push(json));

    expect(writes).toHaveLength(1);
    const parsed = JSON.parse(writes[0]!) as Record<string, unknown>;
    expect(parsed).toMatchObject({ scan_id: "scan-123", stage: "osv_query", retry: 2 });
    expect(writes[0]).not.toContain("ultra-secret");
    expect(writes[0]).not.toContain("hidden-token");
    expect(parsed).not.toHaveProperty("api_key");
    expect(parsed.reason).not.toContain("\n");
  });

  it("does not pass unapproved fields through to persisted audit records", () => {
    const sanitized = sanitizeAuditEvent({
      scan_id: "scan-1", timestamp: "now", stage: "match", status: "CONFIRMED",
      reason: "exact package range", token: "should-not-exist",
    } as Parameters<typeof sanitizeAuditEvent>[0] & { token: string });

    expect(sanitized).not.toHaveProperty("token");
    expect(sanitized.reason).toBe("exact package range");
  });
});
