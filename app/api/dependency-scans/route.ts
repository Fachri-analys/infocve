import { NextResponse } from "next/server";
import { ScanUploadError } from "@/lib/scanner/upload";
import { runUploadedNpmScan } from "@/lib/scanner/scan-service";
import { getClientIp, scanRateLimiter } from "@/lib/security/rate-limit";
import { pruneExpiredScans } from "@/lib/scanner/scan-repository";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = scanRateLimiter.check(ip, {
    maxRequests: parseInt(process.env.SCAN_RATE_LIMIT_MAX || "20", 10) || 20,
    windowSeconds: 60,
  });

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan pemindaian. Silakan coba lagi nanti." },
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
  await pruneExpiredScans().catch(() => 0);

  try {
    const result = await runUploadedNpmScan(request);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ScanUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(
      { error: "Pemindaian tidak dapat disimpan. Data unggahan tidak disimpan oleh InfoCVE." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
