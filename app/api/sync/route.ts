import { NextRequest, NextResponse } from "next/server";
import { SyncEngine } from "@/lib/sync/sync-engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json({ error: "Sync endpoint is disabled: ADMIN_SECRET is not configured." }, { status: 403 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${adminSecret}`) {
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
