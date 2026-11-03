import { NextRequest, NextResponse } from "next/server";
import { isNeonCveConfigured } from "@/lib/db/neon-cve-repository";
import { getPendingNeonTranslationCount, processPendingNeonTranslations } from "@/lib/translation/neon-queue";
import { timingSafeStringCompare } from "@/lib/security/rate-limit";
import { summarizeSyncStatus } from "@/lib/sync/sync-status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const TRANSLATION_WORK_BUDGET_MS = 42_000;
const TRANSLATION_BATCH_SIZE = 512;
const TRANSLATION_CONCURRENCY = 8;
const TRANSLATION_TIMEOUT_MS = 4_000;
const TRANSLATION_ATTEMPTS = 2;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Scheduled translation is disabled: CRON_SECRET is not configured." }, { status: 403 });
  }
  if (!timingSafeStringCompare(request.headers.get("authorization") ?? "", `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isNeonCveConfigured()) {
    return NextResponse.json({ error: "Neon is required for the persistent translation queue." }, { status: 503 });
  }

  try {
    const startedAt = Date.now();
    const result = await processPendingNeonTranslations(TRANSLATION_BATCH_SIZE, undefined, {
      concurrency: TRANSLATION_CONCURRENCY,
      timeoutMs: TRANSLATION_TIMEOUT_MS,
      attempts: TRANSLATION_ATTEMPTS,
      databaseReserveMs: 8_000,
      workBudgetMs: TRANSLATION_WORK_BUDGET_MS,
    });
    const pending = await getPendingNeonTranslationCount();
    const status = summarizeSyncStatus([{
      sourceId: "TRANSLATION",
      success: result.failed === 0 && pending === 0,
    }]);
    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      ...result,
      elapsedMs: Date.now() - startedAt,
      budgetExhausted: result.deferred > 0,
      pending,
    });
  } catch {
    return NextResponse.json({ status: "failed", error: "Translation queue processing failed.", timestamp: new Date().toISOString() }, { status: 500 });
  }
}
