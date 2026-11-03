import "server-only";

import type { CVE } from "@/types/cve";
import { fillMissingCveEntities } from "./cna-fallback";
import { ensureNeonCveSchema, getNeonCveClient, upsertNeonCves } from "@/lib/db/neon-cve-repository";

export async function processPendingNeonCna(
  limit = 16,
  sql = getNeonCveClient(),
  options: { concurrency?: number; timeoutMs?: number; maxAttempts?: number; fetcher?: typeof fetch; cveIds?: string[] } = {}
): Promise<{ processed: number; enriched: number; unresolved: number; failed: number; pending: number }> {
  if (!sql) return { processed: 0, enriched: 0, unresolved: 0, failed: 0, pending: 0 };
  await ensureNeonCveSchema(sql);
  const jobs = await sql.query(`
    WITH due AS (
      SELECT cve_id FROM infocve_cna_queue
      WHERE ((status IN ('PENDING', 'FAILED') AND (next_attempt_at IS NULL OR next_attempt_at <= NOW()))
        OR (status = 'RUNNING' AND updated_at < NOW() - INTERVAL '5 minutes')
      ) AND ($2::text[] IS NULL OR cve_id = ANY($2::text[]))
      ORDER BY updated_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED
    )
    UPDATE infocve_cna_queue AS queue SET status = 'RUNNING', updated_at = NOW()
    FROM due WHERE queue.cve_id = due.cve_id
    RETURNING queue.cve_id, queue.attempts
  `, [Math.max(1, Math.min(limit, 32)), options.cveIds ?? null]) as Array<{ cve_id: string; attempts: number }>;
  if (jobs.length === 0) return { processed: 0, enriched: 0, unresolved: 0, failed: 0, pending: await countPending(sql) };

  const records = await sql.query("SELECT id, payload FROM infocve_cves WHERE id = ANY($1::text[])", [jobs.map(({ cve_id }) => cve_id)]) as Array<{ id: string; payload: CVE }>;
  const recordsById = new Map(records.map((row) => [row.id, row.payload]));
  const enriched = await mapWithConcurrency(jobs, Math.max(1, Math.min(options.concurrency ?? 8, 8)), async (job) => {
    const cve = recordsById.get(job.cve_id);
    if (!cve) return { job, cve: null };
    return { job, cve: await fillMissingCveEntities(cve, options.fetcher ?? fetch, options.timeoutMs ?? 3_000) };
  });

  const changed = enriched.flatMap(({ job, cve }) => cve && (cve.vendor !== recordsById.get(job.cve_id)?.vendor || cve.product !== recordsById.get(job.cve_id)?.product) ? [cve] : []);
  if (changed.length) await upsertNeonCves(changed, sql, { enqueueCna: false });

  const maxAttempts = Math.max(1, options.maxAttempts ?? 5);
  const updates = enriched.map(({ job, cve }) => {
    const resolved = Boolean(cve?.vendor && cve.product && cve.vendor !== "Unknown Vendor" && cve.product !== "Unknown Product");
    const attempts = job.attempts + 1;
    return {
      cve_id: job.cve_id,
      status: resolved || attempts >= maxAttempts ? "COMPLETED" : "FAILED",
      attempts,
      next_attempt_minutes: Math.min(60, Math.max(1, 2 ** Math.min(job.attempts, 6))),
      last_error: resolved ? null : attempts >= maxAttempts ? "No usable CNA vendor/product metadata after maximum retries." : "CNA metadata lookup did not produce complete vendor/product metadata.",
      unresolved: !resolved,
    };
  });
  await sql.query(`UPDATE infocve_cna_queue AS queue SET status = data.status, attempts = data.attempts,
    next_attempt_at = CASE WHEN data.status = 'FAILED' THEN NOW() + (data.next_attempt_minutes::text || ' minutes')::interval ELSE NULL END,
    last_error = data.last_error, updated_at = NOW()
    FROM jsonb_to_recordset($1::jsonb) AS data(cve_id TEXT, status TEXT, attempts INTEGER, next_attempt_minutes INTEGER, last_error TEXT)
    WHERE queue.cve_id = data.cve_id`, [JSON.stringify(updates)]);

  return {
    processed: jobs.length,
    enriched: changed.length,
    unresolved: updates.filter(({ unresolved }) => unresolved).length,
    failed: updates.filter(({ status }) => status === "FAILED").length,
    pending: await countPending(sql),
  };
}

async function countPending(sql: NonNullable<ReturnType<typeof getNeonCveClient>>): Promise<number> {
  const rows = await sql.query("SELECT COUNT(*)::bigint AS count FROM infocve_cna_queue WHERE status IN ('PENDING', 'FAILED', 'RUNNING')") as Array<{ count: number | string }>;
  return Number(rows[0]?.count ?? 0);
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, map: (item: T) => Promise<R>): Promise<R[]> {
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
