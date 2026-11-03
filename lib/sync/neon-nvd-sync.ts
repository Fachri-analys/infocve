import "server-only";

import { randomUUID } from "node:crypto";
import { CisaKevSourceAdapter } from "@/lib/sources/cisa-kev";
import { EpssSourceAdapter } from "@/lib/sources/epss";
import { processPendingNeonCna } from "@/lib/cve/neon-cna-queue";
import { acquireNeonSyncLease, getNeonCveClient, getNeonSyncState, releaseNeonSyncLease, updateNeonSyncState, upsertNeonCves } from "@/lib/db/neon-cve-repository";
import { fetchNvd } from "@/lib/nvd-client";
import { normalizeNvdCveRecords } from "@/lib/nvd-normalize";
import type { CVE, EPSSScore } from "@/types/cve";
import { acquireNvdSyncSlot } from "./nvd-rate-limit";

export const NEON_SYNC_LIMITS = {
  pageSize: 2_000,
  pagesPerRun: 1,
  nvdTimeoutMs: 10_000,
  nvdAttempts: 2,
  cisaTimeoutMs: 8_000,
  epssTimeoutMs: 3_000,
  epssBatchSize: 100,
  epssConcurrency: 5,
  cnaBatchSize: 16,
  cnaConcurrency: 8,
  cnaTimeoutMs: 3_000,
} as const;

const MAX_WINDOW_DAYS = 120;

export interface NeonSyncResult {
  acquired: boolean;
  backfill: boolean;
  pagesProcessed: number;
  itemsSynced: number;
  totalResults: number | null;
  complete: boolean;
  cna: { processed: number; enriched: number; unresolved: number; failed: number; pending: number };
  warnings: string[];
}

export async function syncNvdToNeon(): Promise<NeonSyncResult> {
  const sql = getNeonCveClient();
  if (!sql) throw new Error("Neon is required for the Vercel CVE catalog sync.");
  const owner = randomUUID();
  const acquired = await acquireNeonSyncLease(owner, 240, sql);
  if (!acquired) {
    return { acquired: false, backfill: false, pagesProcessed: 0, itemsSynced: 0, totalResults: null, complete: false,
      cna: { processed: 0, enriched: 0, unresolved: 0, failed: 0, pending: 0 }, warnings: [] };
  }

  let backfill = false;
  let pagesProcessed = 0;
  let itemsSynced = 0;
  let totalResults: number | null = null;
  let complete = false;
  const warnings: string[] = [];
  let cna = { processed: 0, enriched: 0, unresolved: 0, failed: 0, pending: 0 };
  try {
    const state = await getNeonSyncState(sql);
    let windowStart = state.sync_window_start;
    let windowEnd = state.sync_window_end;
    let windowType = state.sync_window_type;
    let startIndex = state.sync_next_index;
    totalResults = state.sync_total_results;

    if (!windowStart || !windowEnd || !windowType) {
      const now = new Date();
      windowEnd = now.toISOString();
      if (!state.backfill_completed_at) {
        backfill = true;
        windowType = "backfill";
        windowStart = new Date(now.getTime() - MAX_WINDOW_DAYS * 86_400_000).toISOString();
      } else {
        windowType = "incremental";
        const resumeStart = state.last_modified_at ? new Date(new Date(state.last_modified_at).getTime() - 5 * 60_000) : new Date(now.getTime() - MAX_WINDOW_DAYS * 86_400_000);
        windowStart = new Date(Math.max(resumeStart.getTime(), now.getTime() - MAX_WINDOW_DAYS * 86_400_000)).toISOString();
      }
      startIndex = 0;
      totalResults = null;
      await updateNeonSyncState({ owner, windowStart, windowEnd, windowType, nextIndex: 0, totalResults: null }, sql);
    } else {
      backfill = windowType === "backfill";
    }
    if (!getNvdSyncDateRange(windowStart, windowEnd)) throw new Error("NVD sync date window exceeds the supported 120-day range.");

    const cisaPromise = new CisaKevSourceAdapter({ timeoutMs: NEON_SYNC_LIMITS.cisaTimeoutMs }).fetchCatalog()
      .then((catalog) => ({ catalog, available: catalog.size > 0 }))
      .catch(() => ({ catalog: new Map(), available: false }));
    const epss = new EpssSourceAdapter({ timeoutMs: NEON_SYNC_LIMITS.epssTimeoutMs });
    while (pagesProcessed < NEON_SYNC_LIMITS.pagesPerRun && (totalResults === null || startIndex < totalResults)) {
      await acquireNvdSyncSlot();
      const params = windowType === "backfill"
        ? { pubStartDate: windowStart, pubEndDate: windowEnd, resultsPerPage: NEON_SYNC_LIMITS.pageSize, startIndex }
        : { lastModStartDate: windowStart, lastModEndDate: windowEnd, resultsPerPage: NEON_SYNC_LIMITS.pageSize, startIndex };
      const response = await fetchNvd(params, {
        noStore: true,
        timeoutMs: NEON_SYNC_LIMITS.nvdTimeoutMs,
        maxAttempts: NEON_SYNC_LIMITS.nvdAttempts,
        maxRetryDelayMs: 1_000,
      });
      totalResults = response.totalResults;
      const records = response.vulnerabilities.map(({ cve }) => cve);
      const cves = normalizeNvdCveRecords(records, true);
      await persistNvdPageSafely(
        cves,
        async (items) => { await upsertNeonCves(items, sql); },
        async (items) => {
          const [epssById, { catalog: cisaCatalog, available: cisaAvailable }] = await Promise.all([
            fetchEpssInBatches(epss, items.map((cve) => cve.id)),
            cisaPromise,
          ]);
          if (!cisaAvailable) warnings.push("CISA KEV unavailable; CVE page was saved without refreshed KEV enrichment.");
          if (epssById.size === 0 && items.length > 0) warnings.push("EPSS unavailable or returned no matching scores for this page.");
          for (const cve of items) attachSyncSignals(cve, cisaCatalog, epssById);
        },
        async () => {
          pagesProcessed += 1;
          startIndex += records.length;
          await updateNeonSyncState({ owner, windowStart, windowEnd, windowType, nextIndex: startIndex, totalResults }, sql);
        }
      );
      itemsSynced += cves.length;
      if (records.length === 0) break;
    }

    cna = await processPendingNeonCna(NEON_SYNC_LIMITS.cnaBatchSize, sql, {
      concurrency: NEON_SYNC_LIMITS.cnaConcurrency,
      timeoutMs: NEON_SYNC_LIMITS.cnaTimeoutMs,
    });
    if (cna.pending > 0 || cna.unresolved > 0) warnings.push(`CNA metadata backlog: ${cna.pending} pending, ${cna.unresolved} unresolved in this run.`);

    complete = totalResults !== null && startIndex >= totalResults;
    if (complete) {
      const stateUpdate = windowType === "backfill"
        ? { owner, backfillCompletedAt: new Date().toISOString(), lastModifiedAt: windowEnd, windowStart: null, windowEnd: null, windowType: null, nextIndex: 0, totalResults: null }
        : { owner, lastModifiedAt: windowEnd, windowStart: null, windowEnd: null, windowType: null, nextIndex: 0, totalResults: null };
      await updateNeonSyncState(stateUpdate, sql);
    }

    return { acquired: true, backfill, pagesProcessed, itemsSynced, totalResults, complete, cna, warnings };
  } finally {
    await releaseNeonSyncLease(owner, sql);
  }
}

export async function persistNvdPageSafely<T extends object>(
  cves: T[],
  persist: (items: T[]) => Promise<void>,
  enrich: (items: T[]) => Promise<void>,
  checkpoint: () => Promise<void>
): Promise<void> {
  await persist(cves);
  await enrich(cves);
  await persist(cves);
  await checkpoint();
}

export async function fetchEpssInBatches(adapter: EpssSourceAdapter, ids: string[]): Promise<Map<string, EPSSScore>> {
  const batches: string[][] = [];
  for (let index = 0; index < ids.length; index += NEON_SYNC_LIMITS.epssBatchSize) {
    batches.push(ids.slice(index, index + NEON_SYNC_LIMITS.epssBatchSize));
  }
  const fetched = await mapWithConcurrency(batches, NEON_SYNC_LIMITS.epssConcurrency, (batch) =>
    adapter.fetchBatch(batch).catch(() => new Map<string, EPSSScore>())
  );
  const result = new Map<string, EPSSScore>();
  for (const batch of fetched) {
    for (const [id, score] of batch) result.set(id, score);
  }
  return result;
}

function attachSyncSignals(cve: CVE, kevCatalog: Map<string, { dateAdded: string; dueDate: string; requiredAction: string; notes?: string }>, epss: Map<string, EPSSScore>): void {
  const kev = kevCatalog.get(cve.id.toUpperCase());
  if (kev) {
    cve.cisaKev = { isKev: true, dateAdded: kev.dateAdded, dueDate: kev.dueDate, requiredAction: kev.requiredAction, notes: kev.notes };
    cve.sources = [...new Set([...(cve.sources ?? ["NVD"]), "CISA_KEV"])];
  }
  const hasExploit = cve.references.some((reference) => reference.tags?.some((tag) => tag.toLowerCase() === "exploit"));
  cve.hasPoc = Boolean(cve.hasPoc || hasExploit);
  const score = epss.get(cve.id.toUpperCase());
  if (score) {
    cve.epss = score;
    cve.sources = [...new Set([...(cve.sources ?? ["NVD"]), "EPSS"])];
  }
}

export async function mapWithConcurrency<T, R>(items: T[], concurrency: number, map: (item: T) => Promise<R>): Promise<R[]> {
  const result = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      result[index] = await map(items[index]!);
    }
  }));
  return result;
}

export function getNvdSyncDateRange(start: string, end: string): boolean {
  const span = Date.parse(end) - Date.parse(start);
  return Number.isFinite(span) && span >= 0 && span <= MAX_WINDOW_DAYS * 86_400_000;
}
