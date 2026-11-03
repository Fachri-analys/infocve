import { describe, expect, it } from "vitest";
import { getNvdSyncDateRange, mapWithConcurrency, NEON_SYNC_LIMITS, persistNvdPageSafely } from "@/lib/sync/neon-nvd-sync";
import { summarizeSyncStatus } from "@/lib/sync/sync-status";

describe("incremental NVD sync date windows", () => {
  it("persists core CVEs before enrichment and advances the cursor only after enrichment is persisted", async () => {
    const events: string[] = [];
    const cves: Array<{ id: string; epss?: number }> = [{ id: "CVE-2026-1000" }];
    await persistNvdPageSafely(
      cves,
      async (items) => { events.push(items[0]?.epss ? "persist-enriched" : "persist-core"); },
      async (items) => { events.push("enrich"); items[0]!.epss = 0.42; },
      async () => { events.push("checkpoint"); }
    );
    expect(events).toEqual(["persist-core", "enrich", "persist-enriched", "checkpoint"]);
  });

  it("keeps the page cursor unchanged if enrichment fails after raw CVEs were saved", async () => {
    const events: string[] = [];
    await expect(persistNvdPageSafely(
      [{ id: "CVE-2026-1000" }],
      async () => { events.push("persist-core"); },
      async () => { throw new Error("provider timeout"); },
      async () => { events.push("checkpoint"); }
    )).rejects.toThrow("provider timeout");
    expect(events).toEqual(["persist-core"]);
  });

  it("bounds each invocation to one persisted NVD page and bounded enrichments", () => {
    expect(NEON_SYNC_LIMITS.pagesPerRun).toBe(1);
    expect(NEON_SYNC_LIMITS.pageSize).toBe(1_000);
    expect(NEON_SYNC_LIMITS.nvdTimeoutMs).toBe(45_000);
    expect(NEON_SYNC_LIMITS.nvdAttempts).toBe(1);
    expect(NEON_SYNC_LIMITS.epssBatchSize).toBe(100);
    expect(NEON_SYNC_LIMITS.epssConcurrency).toBe(5);
    expect(NEON_SYNC_LIMITS.cnaBatchSize).toBe(16);
    expect(NEON_SYNC_LIMITS.cnaTimeoutMs).toBe(3_000);
  });

  it("keeps concurrent enrichment fan-out within its configured cap", async () => {
    let active = 0;
    let maximum = 0;
    await mapWithConcurrency(Array.from({ length: 20 }, (_, index) => index), 5, async (value) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active -= 1;
      return value;
    });
    expect(maximum).toBeLessThanOrEqual(5);
  });

  it("accepts windows up to the NVD 120-day limit", () => {
    const start = "2026-01-01T00:00:00.000Z";
    const end = new Date(Date.parse(start) + 120 * 86_400_000).toISOString();
    expect(getNvdSyncDateRange(start, end)).toBe(true);
  });

  it("rejects inverted, invalid, and overlong windows", () => {
    expect(getNvdSyncDateRange("2026-05-01", "2026-01-01")).toBe(false);
    expect(getNvdSyncDateRange("invalid", "2026-01-01")).toBe(false);
    expect(getNvdSyncDateRange("2025-01-01", "2026-01-01")).toBe(false);
  });
});

describe("sync status summary", () => {
  it("distinguishes incomplete catalog pages and translation warnings from sync failures", () => {
    expect(summarizeSyncStatus([{ sourceId: "NVD", success: true, complete: false }])).toBe("incomplete");
    expect(summarizeSyncStatus([
      { sourceId: "NVD", success: true, complete: true },
      { sourceId: "TRANSLATION", success: false },
    ])).toBe("completed_with_warnings");
    expect(summarizeSyncStatus([{ sourceId: "NVD", success: true, complete: true, warning: true }])).toBe("completed_with_warnings");
    expect(summarizeSyncStatus([{ sourceId: "NVD", success: false }])).toBe("failed");
  });
});
