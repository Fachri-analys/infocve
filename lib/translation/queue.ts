import { createHash } from "node:crypto";

import { getDb } from "@/lib/db";
import { createLibreTranslateProvider, translateProtectedText, translateWithRetry } from "./provider";

interface TranslationJob {
  source_hash: string;
  source_text: string;
  attempts: number;
}

let workerRunning = false;
let workerScheduled = false;

/** Persist a translation request before scheduling work so transient process exits do not lose it. */
export function enqueueCveTranslation(cveId: string, sourceText: string): void {
  if (!sourceText.trim()) return;
  const db = getDb();
  const sourceHash = createHash("sha256").update(sourceText).digest("hex");
  const cve = db.prepare("SELECT translation_status, translation_source_hash FROM cves WHERE id = ?").get(cveId) as
    | { translation_status: string; translation_source_hash: string | null }
    | undefined;
  if (!cve) return;
  if (cve.translation_status === "TRANSLATED" && cve.translation_source_hash === sourceHash) return;

  const now = new Date().toISOString();
  const cached = db.prepare("SELECT translated_text, status, next_attempt_at FROM translation_cache WHERE source_hash = ?").get(sourceHash) as
    | { translated_text: string | null; status: string; next_attempt_at: string | null }
    | undefined;
  if (cached?.status === "TRANSLATED" && cached.translated_text) {
    db.prepare("UPDATE cves SET translation_source_hash = ? WHERE id = ?").run(sourceHash, cveId);
    applyTranslation(sourceHash, cached.translated_text);
    return;
  }

  db.prepare(`
    INSERT INTO translation_cache (source_hash, source_text, status, attempts, created_at, updated_at)
    VALUES (?, ?, 'PENDING', 0, ?, ?)
    ON CONFLICT(source_hash) DO UPDATE SET
      source_text = excluded.source_text,
      status = CASE WHEN translation_cache.status = 'FAILED' AND
        (translation_cache.next_attempt_at IS NULL OR translation_cache.next_attempt_at <= excluded.updated_at)
        THEN 'PENDING' ELSE translation_cache.status END,
      next_attempt_at = CASE WHEN translation_cache.status = 'FAILED' AND
        (translation_cache.next_attempt_at IS NULL OR translation_cache.next_attempt_at <= excluded.updated_at)
        THEN NULL ELSE translation_cache.next_attempt_at END,
      updated_at = excluded.updated_at
  `).run(sourceHash, sourceText, now, now);

  const status = cached?.status === "FAILED" && cached.next_attempt_at && cached.next_attempt_at > now ? "FAILED" : "PENDING";
  db.prepare("UPDATE cves SET translation_status = ?, translation_source_hash = ? WHERE id = ?")
    .run(status, sourceHash, cveId);
  scheduleTranslationWorker();
}

/** Process a bounded batch so a slow translation service cannot hold CVE sync open. */
export async function processPendingTranslations(limit = 20): Promise<{ translated: number; failed: number }> {
  if (workerRunning) return { translated: 0, failed: 0 };
  workerRunning = true;
  workerScheduled = false;
  let translated = 0;
  let failed = 0;

  try {
    const db = getDb();
    const now = new Date().toISOString();
    const jobs = db.prepare(`
      SELECT cache.source_hash, cache.source_text, cache.attempts
      FROM translation_cache AS cache
      WHERE cache.status IN ('PENDING', 'FAILED')
        AND (cache.next_attempt_at IS NULL OR cache.next_attempt_at <= ?)
        AND EXISTS (SELECT 1 FROM cves WHERE cves.translation_source_hash = cache.source_hash)
      ORDER BY cache.updated_at ASC
      LIMIT ?
    `).all(now, Math.max(1, Math.min(limit, 100))) as TranslationJob[];

    for (const job of jobs) {
      const endpoint = process.env.INFOCVE_TRANSLATION_URL?.trim();
      if (!endpoint) {
        markFailed(job, "INFOCVE_TRANSLATION_URL is not configured.", 1, 60 * 60 * 1000);
        failed += 1;
        continue;
      }

      try {
        const provider = createLibreTranslateProvider({
          endpoint,
          apiKey: process.env.INFOCVE_TRANSLATION_API_KEY,
        });
        const products = db.prepare(`
          SELECT vendor, product FROM cves WHERE translation_source_hash = ?
        `).all(job.source_hash) as Array<{ vendor: string; product: string }>;
        const protectedNames = Array.from(new Set(products.flatMap(({ vendor, product }) => [vendor, product])
          .filter((name) => name.trim().length >= 2)));
        let attempts = 0;
        const result = await translateWithRetry(job.source_text, (text) => translateProtectedText(text, provider, protectedNames), {
          attempts: 3,
          delayMs: Number(process.env.INFOCVE_TRANSLATION_RETRY_DELAY_MS ?? 400),
          onAttempt: (attempt) => { attempts = attempt; },
        });
        db.prepare(`
          UPDATE translation_cache
          SET translated_text = ?, status = 'TRANSLATED', attempts = attempts + ?,
              next_attempt_at = NULL, last_error = NULL, updated_at = ?
          WHERE source_hash = ?
        `).run(result, attempts, new Date().toISOString(), job.source_hash);
        applyTranslation(job.source_hash, result);
        translated += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Translation provider failed.";
        const attempts = error && typeof error === "object" && "attempts" in error && typeof error.attempts === "number"
          ? Math.max(1, Math.min(error.attempts, 5))
          : 3;
        markFailed(job, message, attempts, retryDelay(job.attempts));
        failed += 1;
      }
    }
  } finally {
    workerRunning = false;
  }

  return { translated, failed };
}

function applyTranslation(sourceHash: string, translatedText: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE cves
    SET description_id = ?, translation_status = 'TRANSLATED', translation_source_hash = ?
    WHERE translation_source_hash = ?
  `).run(translatedText, sourceHash, sourceHash);
}

function markFailed(job: TranslationJob, message: string, addedAttempts: number, delayMs: number): void {
  const db = getDb();
  const now = new Date();
  db.prepare(`
    UPDATE translation_cache
    SET status = 'FAILED', attempts = attempts + ?, next_attempt_at = ?, last_error = ?, updated_at = ?
    WHERE source_hash = ?
  `).run(
    addedAttempts,
    new Date(now.getTime() + delayMs).toISOString(),
    message.slice(0, 500),
    now.toISOString(),
    job.source_hash
  );
  db.prepare("UPDATE cves SET translation_status = 'FAILED' WHERE translation_source_hash = ?")
    .run(job.source_hash);
}

function retryDelay(attempts: number): number {
  return Math.min(60 * 60 * 1000, 60_000 * 2 ** Math.min(attempts, 5));
}

function scheduleTranslationWorker(): void {
  scheduleTranslationWorkerAfter(0);
}

function scheduleTranslationWorkerAfter(delayMs: number): void {
  if (workerScheduled || workerRunning || process.env.NODE_ENV === "test") return;
  workerScheduled = true;
  setTimeout(() => {
    void processPendingTranslations().then(() => {
      scheduleNextTranslationRun();
    }).catch(() => {
      workerScheduled = false;
    });
  }, delayMs);
}

function scheduleNextTranslationRun(): void {
  if (process.env.NODE_ENV === "test") return;
  const db = getDb();
  const now = new Date().toISOString();
  const rows = db.prepare(`
    SELECT cache.status, cache.next_attempt_at
    FROM translation_cache AS cache
    WHERE cache.status IN ('PENDING', 'FAILED')
      AND EXISTS (SELECT 1 FROM cves WHERE cves.translation_source_hash = cache.source_hash)
  `).all() as Array<{ status: string; next_attempt_at: string | null }>;
  const due = rows.some((row) => row.status === "PENDING" || !row.next_attempt_at || row.next_attempt_at <= now);
  if (due) {
    scheduleTranslationWorkerAfter(0);
    return;
  }
  const retryAt = rows
    .map((row) => row.next_attempt_at)
    .filter((value): value is string => Boolean(value))
    .sort()[0];
  if (retryAt) scheduleTranslationWorkerAfter(Math.max(1_000, new Date(retryAt).getTime() - Date.now()));
}
