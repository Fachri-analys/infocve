import "server-only";

import { createLibreTranslateBatchProvider, translateBatchWithRetry, type TranslationBatchProvider } from "./provider";
import { getSafeTranslationGroupLimit, groupTranslationJobs, type TranslationJob } from "./batching";
import { ensureNeonCveSchema, getNeonCveClient } from "@/lib/db/neon-cve-repository";

export async function processPendingNeonTranslations(
  limit = 512,
  sql = getNeonCveClient(),
  options: { concurrency?: number; timeoutMs?: number; attempts?: number; workBudgetMs?: number; databaseReserveMs?: number; sourceHashes?: string[]; provider?: TranslationBatchProvider } = {}
): Promise<{ translated: number; failed: number; requests: number; batches: number; deferred: number }> {
  if (!sql) return { translated: 0, failed: 0, requests: 0, batches: 0, deferred: 0 };
  await ensureNeonCveSchema(sql);
  const jobs = await sql.query(`
    WITH due AS (
      SELECT source_hash FROM infocve_translation_cache
      WHERE ($2::text[] IS NULL OR source_hash = ANY($2::text[])) AND (
        (status IN ('PENDING', 'FAILED') AND (next_attempt_at IS NULL OR next_attempt_at <= NOW()))
        OR (status = 'RUNNING' AND updated_at < NOW() - INTERVAL '5 minutes')
      )
      ORDER BY updated_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED
    )
    UPDATE infocve_translation_cache AS cache SET status = 'RUNNING', updated_at = NOW()
    FROM due WHERE cache.source_hash = due.source_hash
    RETURNING cache.source_hash, cache.source_text, cache.attempts
  `, [Math.max(1, Math.min(limit, 512)), options.sourceHashes ?? null]) as TranslationJob[];
  if (!jobs.length) return { translated: 0, failed: 0, requests: 0, batches: 0, deferred: 0 };

  const endpoint = process.env.INFOCVE_TRANSLATION_URL?.trim();
  if (!endpoint && !options.provider) {
    await markFailed(sql, jobs, "INFOCVE_TRANSLATION_URL is not configured.");
    return { translated: 0, failed: jobs.length, requests: 0, batches: 0, deferred: 0 };
  }

  const productRows = await sql.query(`SELECT translation_source_hash AS source_hash, vendor, product FROM infocve_cves
    WHERE translation_source_hash = ANY($1::text[]) AND (vendor IS NOT NULL OR product IS NOT NULL)`, [jobs.map((job) => job.source_hash)]) as Array<{
      source_hash: string; vendor: string | null; product: string | null;
    }>;
  const identifiersByHash = new Map<string, Set<string>>();
  for (const row of productRows) {
    const names = identifiersByHash.get(row.source_hash) ?? new Set<string>();
    for (const value of [row.vendor, row.product]) if (value?.trim()) names.add(value.trim());
    identifiersByHash.set(row.source_hash, names);
  }

  const allGroups = groupTranslationJobs(jobs);
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 8, 8));
  const timeoutMs = options.timeoutMs ?? 4_000;
  const maxAttempts = options.attempts ?? 2;
  const workBudgetMs = options.workBudgetMs ?? 42_000;
  const databaseReserveMs = options.databaseReserveMs ?? 8_000;
  const safeGroupLimit = getSafeTranslationGroupLimit({
    workBudgetMs, databaseReserveMs, concurrency, timeoutMs, attempts: maxAttempts, retryDelayMs: getRetryDelay(),
  });
  const groups = allGroups.slice(0, safeGroupLimit);
  const deferredJobs = allGroups.slice(safeGroupLimit).flatMap(({ jobs: deferred }) => deferred);
  if (deferredJobs.length) {
    await sql.query(`UPDATE infocve_translation_cache SET status = 'PENDING', updated_at = NOW()
      WHERE source_hash = ANY($1::text[]) AND status = 'RUNNING'`, [deferredJobs.map(({ source_hash }) => source_hash)]);
  }
  const provider = options.provider ?? createLibreTranslateBatchProvider({ endpoint: endpoint ?? "", apiKey: process.env.INFOCVE_TRANSLATION_API_KEY, timeoutMs });
  const outcomes = await mapWithConcurrency(groups, concurrency, async (group) => {
    if (group.jobs.some((job) => job.source_text.length > 20_000)) {
      await markFailed(sql, group.jobs, "Description exceeds the translation provider's 20,000-character limit.");
      return { translated: 0, failed: group.jobs.length, requests: 0 };
    }
    let requestAttempts = 0;
    try {
      const translations = await translateBatchWithRetry(group.jobs.map((job) => ({
        text: job.source_text,
        identifiers: Array.from(identifiersByHash.get(job.source_hash) ?? []),
      })), provider, {
        attempts: maxAttempts,
        delayMs: getRetryDelay(),
        onAttempt: (attempt) => { requestAttempts = attempt; },
      });
      await saveTranslations(sql, group.jobs.map((job, index) => ({
        source_hash: job.source_hash,
        translated_text: translations[index]!,
        attempts: requestAttempts,
      })));
      return { translated: group.jobs.length, failed: 0, requests: requestAttempts };
    } catch {
      await markFailed(sql, group.jobs, "Translation provider failed or returned invalid protected identifiers.", Math.max(1, requestAttempts));
      return { translated: 0, failed: group.jobs.length, requests: requestAttempts };
    }
  });

  return {
    translated: outcomes.reduce((total, outcome) => total + outcome.translated, 0),
    failed: outcomes.reduce((total, outcome) => total + outcome.failed, 0),
    requests: outcomes.reduce((total, outcome) => total + outcome.requests, 0),
    batches: groups.length,
    deferred: deferredJobs.length,
  };
}

export async function getPendingNeonTranslationCount(sql = getNeonCveClient()): Promise<number> {
  if (!sql) return 0;
  await ensureNeonCveSchema(sql);
  const rows = await sql.query(`SELECT COUNT(*)::bigint AS count FROM infocve_translation_cache
    WHERE status IN ('PENDING', 'FAILED', 'RUNNING')`) as Array<{ count: number | string }>;
  return Number(rows[0]?.count ?? 0);
}

function getRetryDelay(): number {
  const configured = Number(process.env.INFOCVE_TRANSLATION_RETRY_DELAY_MS ?? 400);
  return Number.isFinite(configured) ? Math.max(0, Math.min(configured, 1_000)) : 400;
}

async function saveTranslations(sql: NonNullable<ReturnType<typeof getNeonCveClient>>, rows: Array<{ source_hash: string; translated_text: string; attempts: number }>): Promise<void> {
  const payload = JSON.stringify(rows);
  await sql.transaction((tx) => [
    tx.query(`UPDATE infocve_translation_cache AS cache SET translated_text = data.translated_text, status = 'TRANSLATED',
      attempts = cache.attempts + data.attempts, next_attempt_at = NULL, last_error = NULL, updated_at = NOW()
      FROM jsonb_to_recordset($1::jsonb) AS data(source_hash TEXT, translated_text TEXT, attempts INTEGER)
      WHERE cache.source_hash = data.source_hash`, [payload]),
    tx.query(`UPDATE infocve_cves AS cve SET description_id = data.translated_text, translation_status = 'TRANSLATED',
      payload = jsonb_set(jsonb_set(cve.payload, '{descriptionId}', to_jsonb(data.translated_text), TRUE), '{translationStatus}', '"TRANSLATED"'::jsonb, TRUE)
      FROM jsonb_to_recordset($1::jsonb) AS data(source_hash TEXT, translated_text TEXT, attempts INTEGER)
      WHERE cve.translation_source_hash = data.source_hash`, [payload]),
  ]);
}

async function markFailed(sql: NonNullable<ReturnType<typeof getNeonCveClient>>, jobs: TranslationJob[], message: string, attemptIncrement = 1): Promise<void> {
  await sql.transaction((tx) => [
    tx.query(`UPDATE infocve_translation_cache AS cache SET status = 'FAILED', attempts = cache.attempts + $3,
      next_attempt_at = NOW() + (INTERVAL '1 minute' * LEAST(60, GREATEST(1, power(2, LEAST(cache.attempts, 6))))),
      last_error = $2, updated_at = NOW()
      FROM jsonb_to_recordset($1::jsonb) AS data(source_hash TEXT)
      WHERE cache.source_hash = data.source_hash`, [JSON.stringify(jobs.map(({ source_hash }) => ({ source_hash }))), message.slice(0, 500), Math.max(1, attemptIncrement)]),
    tx.query(`UPDATE infocve_cves SET translation_status = 'FAILED',
      payload = jsonb_set(payload, '{translationStatus}', '"FAILED"'::jsonb, TRUE)
      WHERE translation_source_hash = ANY($1::text[]) AND translation_status <> 'TRANSLATED'`, [jobs.map(({ source_hash }) => source_hash)]),
  ]);
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, map: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await map(items[index]!);
    }
  }));
  return results;
}
