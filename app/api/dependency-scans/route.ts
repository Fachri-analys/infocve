import { NextResponse } from "next/server";
import { ScanUploadError } from "@/lib/scanner/upload";
import { runUploadedNpmScan } from "@/lib/scanner/scan-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
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
