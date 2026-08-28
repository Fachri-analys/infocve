import { getDb } from "@/lib/db";
import { getLatestCVEs, getRecentCVEs } from "@/lib/nvd";
import { ThreatIntelligenceAggregator } from "@/lib/sources/aggregator";
import { CisaKevSourceAdapter } from "@/lib/sources/cisa-kev";
import { NotificationEngine } from "@/lib/notifications/notification-engine";

export interface SyncRunResult {
  sourceId: string;
  success: boolean;
  itemsSynced: number;
  error?: string;
  durationMs: number;
}

export class SyncEngine {
  private static isSyncing = false;

  /**
   * Run synchronization across all configured sources
   */
  static async runFullSync(): Promise<{ results: SyncRunResult[]; totalSynced: number }> {
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

      // Update data source sync status
      this.updateSourceStatus("NVD", nvdResult.success, nvdResult.itemsSynced, nvdResult.error);
      this.updateSourceStatus("CISA_KEV", kevResult.success, kevResult.itemsSynced, kevResult.error);
      this.updateSourceStatus("EPSS", true, totalSynced);
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
   * Sync NVD latest and recently modified feeds + enrich with EPSS, CISA, GHSA
   */
  private static async syncNvdFeeds(): Promise<SyncRunResult> {
    const startTime = Date.now();
    const runId = this.logSyncStart("NVD");

    try {
      // Fetch latest published and recent modified
      const [latest, recent] = await Promise.all([
        getLatestCVEs(20).catch(() => []),
        getRecentCVEs(20).catch(() => []),
      ]);

      const combinedMap = new Map<string, typeof latest[0]>();
      for (const cve of latest) combinedMap.set(cve.id, cve);
      for (const cve of recent) combinedMap.set(cve.id, cve);

      const allCves = Array.from(combinedMap.values());

      // Multi-source enrichment + database persistence
      const enriched = await ThreatIntelligenceAggregator.enrichBatch(allCves, true);

      // Dispatch notifications for critical CVEs or CISA KEV additions
      for (const cve of enriched) {
        if (cve.cvss.severity === "CRITICAL" || cve.cisaKev?.isKev) {
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

  private static updateSourceStatus(sourceId: string, success: boolean, count: number, error?: string): void {
    try {
      const db = getDb();
      db.prepare(`
        UPDATE data_sources
        SET last_sync_at = ?, sync_status = ?, total_records = total_records + ?, last_error = ?, updated_at = ?
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
