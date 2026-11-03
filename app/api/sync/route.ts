import { NextRequest, NextResponse } from "next/server";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { checkSharedRateLimit, getClientIp, syncRateLimiter, timingSafeStringCompare } from "@/lib/security/rate-limit";
import { pruneExpiredScans } from "@/lib/scanner/scan-repository";
import { pruneNeonRateLimits } from "@/lib/db/neon-cve-repository";
import { summarizeSyncStatus } from "@/lib/sync/sync-status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Scheduled sync is disabled: CRON_SECRET is not configured." }, { status: 403 });
  }
  if (!timingSafeStringCompare(req.headers.get("authorization") ?? "", `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!process.env.DATABASE_URL?.trim() && !process.env.POSTGRES_URL?.trim()) {
      return NextResponse.json({ error: "Neon DATABASE_URL is required for scheduled CVE synchronization." }, { status: 503 });
    }
    const maintenance = await Promise.allSettled([pruneExpiredScans(), pruneNeonRateLimits()]);
    for (const result of maintenance) {
      if (result.status === "rejected") {
        console.warn(JSON.stringify({ event: "sync_maintenance_failed", message: result.reason instanceof Error ? result.reason.message : "Unknown cleanup error" }));
      }
    }
    const { results, totalSynced } = await SyncEngine.runFullSync();
    const status = summarizeSyncStatus(results);
    return NextResponse.json({ status, timestamp: new Date().toISOString(), totalSynced, results }, { status: status === "failed" ? 500 : 200 });
  } catch {
    return NextResponse.json({ status: "error", timestamp: new Date().toISOString(), error: "Scheduled sync failed." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = await checkSharedRateLimit(`sync:${ip}`, {
    maxRequests: parseInt(process.env.SYNC_RATE_LIMIT_MAX || "10", 10) || 10,
    windowSeconds: 60,
  }, syncRateLimiter);

  if (rateLimit.unavailable) return NextResponse.json({ error: "Shared rate limit storage is unavailable." }, { status: 503, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan sinkronisasi. Silakan coba lagi nanti." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json({ error: "Sync endpoint is disabled: ADMIN_SECRET is not configured." }, { status: 403 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expectedAuth = `Bearer ${adminSecret}`;
  if (!timingSafeStringCompare(authHeader, expectedAuth)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.VERCEL === "1" && !process.env.DATABASE_URL?.trim() && !process.env.POSTGRES_URL?.trim()) {
    return NextResponse.json({ error: "Neon DATABASE_URL is required for Vercel CVE synchronization." }, { status: 503 });
  }

  try {
    const { results, totalSynced } = await SyncEngine.runFullSync();
    const status = summarizeSyncStatus(results);
    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      totalSynced,
      results,
    }, { status: status === "failed" ? 500 : 200 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: "error", error: errorMsg, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
