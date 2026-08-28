import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { CveRepository } from "@/lib/db/cve-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const stats = CveRepository.getStats();
    const sources = db.prepare("SELECT id, name, type, sync_status, last_sync_at, total_records FROM data_sources").all();

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "0.1.0",
      database: "sqlite (native)",
      stats,
      dataSources: sources,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: "unhealthy", error: errorMsg, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
