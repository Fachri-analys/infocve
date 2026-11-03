import { getDb } from "@/lib/db";
import { fetchNvd } from "@/lib/nvd-client";
import { normalizeNvdCveRecords } from "@/lib/nvd-normalize";
import { fillMissingCveEntities } from "@/lib/cve/cna-fallback";
import { acquireNvdSyncSlot } from "./nvd-rate-limit";
import { ThreatIntelligenceAggregator } from "@/lib/sources/aggregator";
import { CisaKevSourceAdapter } from "@/lib/sources/cisa-kev";
import { EpssSourceAdapter } from "@/lib/sources/epss";
import { NotificationEngine } from "@/lib/notifications/notification-engine";
import { syncNvdToNeon } from "./neon-nvd-sync";

export interface SyncRunResult {
  sourceId: string;
  success: boolean;
  complete?: boolean;
  warning?: boolean;
  itemsSynced: number;
  error?: string;
  warningMessage?: string;
  durationMs: number;
}

export class SyncEngine {
  private static isSyncing = false;

  /**
   * Run synchronization across all configured sources
   */
  static async runFullSync(): Promise<{ results: SyncRunResult[]; totalSynced: number }> {
    if (process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim()) {
      const started = Date.now();
      const result = await syncNvdToNeon();
      const summary: SyncRunResult = {
        sourceId: "NVD",
        success: result.acquired && (result.complete || result.pagesProcessed > 0),
        complete: result.complete,
        warning: result.warnings.length > 0,
        itemsSynced: result.itemsSynced,
        warningMessage: result.warnings.join(" ") || undefined,
        error: result.acquired ? undefined : "Sync already in progress in another instance.",
        durationMs: Date.now() - started,
      };
      return { results: [summary], totalSynced: result.itemsSynced };
    }

    if (this.isSyncing) {
      return {
        results: [{ sourceId: "ALL", success: false, itemsSynced: 0, error: "Sync already in progress", durationMs: 0 }],
        totalSynced: 0,
      };
    }

    this.isSyncing = true;
    const results: SyncRunResult[] = [];
    let totalSynced = 0;

    try {
      // 1. Sync CISA KEV catalog
      const kevResult = await this.syncCisaKev();
      results.push(kevResult);
      totalSynced += kevResult.itemsSynced;

      // 2. Sync Recent & Latest CVEs from NVD with multi-source enrichment
      const nvdResult = await this.syncNvdFeeds();
      results.push(nvdResult);
      totalSynced += nvdResult.itemsSynced;

      // 3. Check EPSS independently
      const epssResult = await this.probeEpss();
      results.push(epssResult);

      // Update data source sync status with real counts
      this.updateSourceStatus("NVD", nvdResult.success, nvdResult.itemsSynced, nvdResult.error);
      this.updateSourceStatus("CISA_KEV", kevResult.success, kevResult.itemsSynced, kevResult.error);
      this.updateSourceStatus("EPSS", epssResult.success, epssResult.itemsSynced, epssResult.error);
    } finally {
      this.isSyncing = false;
    }

    return { results, totalSynced };
  }

  /**
   * Sync CISA KEV feed
   */
  private static async syncCisaKev(): Promise<SyncRunResult> {
    const startTime = Date.now();
    const runId = this.logSyncStart("CISA_KEV");

    try {
      const adapter = new CisaKevSourceAdapter();
      const catalog = await adapter.fetchCatalog();
      const count = catalog.size;

      this.logSyncEnd(runId, "SUCCESS", count);
      return {
        sourceId: "CISA_KEV",
        success: true,
        itemsSynced: count,
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logSyncEnd(runId, "FAILED", 0, errorMsg);
      return {
        sourceId: "CISA_KEV",
        success: false,
        itemsSynced: 0,
        error: errorMsg,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Probe EPSS service health — reflects real reachability instead of
   * blindly reporting "healthy".
   */
  private static async probeEpss(): Promise<SyncRunResult> {
    const startTime = Date.now();
    const runId = this.logSyncStart("EPSS");

    try {
      const adapter = new EpssSourceAdapter();
      const reachable = await adapter.testConnection();
      if (!reachable) {
        this.logSyncEnd(runId, "FAILED", 0, "EPSS API unreachable or returned no data");
        return {
          sourceId: "EPSS",
          success: false,
          itemsSynced: 0,
          error: "EPSS API unreachable or returned no data",
          durationMs: Date.now() - startTime,
        };
      }

      this.logSyncEnd(runId, "SUCCESS", 1);
      return {
        sourceId: "EPSS",
        success: true,
        itemsSynced: 1,
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logSyncEnd(runId, "FAILED", 0, errorMsg);
      return {
        sourceId: "EPSS",
        success: false,
        itemsSynced: 0,
        error: errorMsg,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Sync NVD latest and recently modified feeds + enrich with EPSS, CISA, GHSA.
   *
   * Fetches a wider window (up to 50 per feed) and does NOT silently swallow
   * NVD failures — if both feeds fail the result reports the error.
   */
  private static async syncNvdFeeds(): Promise<SyncRunResult> {
    const startTime = Date.now();
    const runId = this.logSyncStart("NVD");

    try {
      const now = new Date();
      const start = new Date(now.getTime() - 120 * 86_400_000).toISOString();
      const end = now.toISOString();
      const allCves = new Map<string, ReturnType<typeof normalizeNvdCveRecords>[number]>();
      let totalResults = 0;
      for (let startIndex = 0; ; startIndex += 2_000) {
        await acquireNvdSyncSlot();
        const response = await fetchNvd({ pubStartDate: start, pubEndDate: end, resultsPerPage: 2_000, startIndex }, { noStore: true, timeoutMs: 20_000 });
        totalResults = response.totalResults;
        const records = normalizeNvdCveRecords(response.vulnerabilities.map(({ cve }) => cve), true);
        const enrichedEntities = await Promise.all(records.map((cve) => fillMissingCveEntities(cve)));
        for (const cve of enrichedEntities) allCves.set(cve.id, cve);
        await ThreatIntelligenceAggregator.enrichBatch(enrichedEntities, true);
        if (startIndex + response.vulnerabilities.length >= totalResults || response.vulnerabilities.length === 0) break;
      }

      // Multi-source enrichment + database persistence
      const enriched = [...allCves.values()];

      // Dispatch notifications for critical CVEs or CISA KEV additions
      for (const cve of enriched) {
        if (cve.cvss?.severity === "CRITICAL" || cve.cisaKev?.isKev) {
          NotificationEngine.dispatchVulnerabilityAlert(cve).catch(() => {});
        }
      }

      this.logSyncEnd(runId, "SUCCESS", enriched.length);
      return {
        sourceId: "NVD",
        success: true,
        itemsSynced: enriched.length,
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logSyncEnd(runId, "FAILED", 0, errorMsg);
      return {
        sourceId: "NVD",
        success: false,
        itemsSynced: 0,
        error: errorMsg,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Auto-sync on first boot if the CVE table is empty.
   * Called from instrumentation or health check; safe to call multiple times.
   */
  static async autoSyncIfEmpty(): Promise<void> {
    try {
      const db = getDb();
      const row = db.prepare("SELECT COUNT(*) as count FROM cves").get() as { count: number | bigint } | undefined;
      const count = Number(row?.count ?? 0);
      if (count === 0) {
        console.log("[SyncEngine] Database is empty — running initial sync...");
        await this.runFullSync();
      }
    } catch (err) {
      console.error("[SyncEngine] autoSyncIfEmpty failed:", err);
    }
  }

  private static logSyncStart(sourceId: string): number {
    try {
      const db = getDb();
      const res = db.prepare(`
        INSERT INTO sync_runs (source_id, start_time, status, items_synced)
        VALUES (?, ?, 'RUNNING', 0)
      `).run(sourceId, new Date().toISOString());
      return Number(res.lastInsertRowid);
    } catch {
      return 0;
    }
  }

  private static logSyncEnd(runId: number, status: string, itemsSynced: number, errorDetails?: string): void {
    if (!runId) return;
    try {
      const db = getDb();
      db.prepare(`
        UPDATE sync_runs
        SET end_time = ?, status = ?, items_synced = ?, error_details = ?
        WHERE id = ?
      `).run(new Date().toISOString(), status, itemsSynced, errorDetails || null, runId);
    } catch {
      // ignore
    }
  }

  /**
   * Update data_sources status — uses absolute count (SET, not +=) so
   * total_records reflects a real snapshot rather than ever-growing sum.
   */
  private static updateSourceStatus(sourceId: string, success: boolean, count: number, error?: string): void {
    try {
      const db = getDb();
      db.prepare(`
        UPDATE data_sources
        SET last_sync_at = ?, sync_status = ?, total_records = ?, last_error = ?, updated_at = ?
        WHERE id = ?
      `).run(
        new Date().toISOString(),
        success ? "healthy" : "error",
        count,
        error || null,
        new Date().toISOString(),
        sourceId
      );
    } catch {
      // ignore
    }
  }
}
