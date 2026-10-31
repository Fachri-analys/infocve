import { NextResponse } from "next/server";
import { getAuthorizedDependencyScan } from "@/lib/scanner/scan-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isScanId(id)) return notFound();
  const token = request.headers.get("x-scan-token") ?? "";
  const report = getAuthorizedDependencyScan(id, token);
  if (!report) return notFound();
  return NextResponse.json({ report }, { headers: { "Cache-Control": "no-store" } });
}

function isScanId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function notFound() {
  return NextResponse.json({ error: "Pemindaian tidak ditemukan atau token akses tidak valid." }, { status: 404, headers: { "Cache-Control": "no-store" } });
}
