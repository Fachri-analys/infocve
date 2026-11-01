import { NextRequest, NextResponse } from "next/server";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { getClientIp, syncRateLimiter, timingSafeStringCompare } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = syncRateLimiter.check(ip, {
    maxRequests: parseInt(process.env.SYNC_RATE_LIMIT_MAX || "10", 10) || 10,
    windowSeconds: 60,
  });

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

  try {
    const { results, totalSynced } = await SyncEngine.runFullSync();
    return NextResponse.json({
      status: "completed",
      timestamp: new Date().toISOString(),
      totalSynced,
      results,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: "error", error: errorMsg, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
