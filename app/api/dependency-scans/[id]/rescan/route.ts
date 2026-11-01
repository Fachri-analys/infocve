import { NextResponse } from "next/server";
import { getAuthorizedDependencyScan, pruneExpiredScans } from "@/lib/scanner/scan-repository";
import { runUploadedNpmScan } from "@/lib/scanner/scan-service";
import { ScanUploadError } from "@/lib/scanner/upload";
import { getClientIp, scanRateLimiter } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(request);
  const rateLimit = scanRateLimiter.check(ip, {
    maxRequests: parseInt(process.env.SCAN_RATE_LIMIT_MAX || "20", 10) || 20,
    windowSeconds: 60,
  });

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan pemindaian ulang. Silakan coba lagi nanti." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  // Prune scans older than configured retention window
  pruneExpiredScans();

  const { id } = await context.params;
  if (!isScanId(id)) return hiddenNotFound();
  const token = request.headers.get("x-scan-token") ?? "";
  const previous = getAuthorizedDependencyScan(id, token);
  if (!previous) return hiddenNotFound();

  try {
    const result = await runUploadedNpmScan(request, previous);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ScanUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Pemindaian ulang tidak dapat disimpan." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

function isScanId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function hiddenNotFound() {
  return NextResponse.json({ error: "Pemindaian tidak ditemukan atau token akses tidak valid." }, { status: 404, headers: { "Cache-Control": "no-store" } });
}
