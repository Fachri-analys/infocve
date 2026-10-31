import { NextResponse } from "next/server";
import { getAuthorizedDependencyScan } from "./scan-repository";
import { buildSecurityPdf } from "./report";

export function authorizedReport(request: Request, scanId: string) {
  if (!isScanId(scanId)) return null;
  return getAuthorizedDependencyScan(scanId, request.headers.get("x-scan-token") ?? "");
}

export function jsonReportResponse(report: NonNullable<ReturnType<typeof authorizedReport>>) {
  return NextResponse.json(report, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="infocve-${report.scanId}.json"`,
    },
  });
}

export function pdfReportResponse(report: NonNullable<ReturnType<typeof authorizedReport>>) {
  const pdf = new Uint8Array(buildSecurityPdf(report));
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="infocve-${report.scanId}.pdf"`,
      "Content-Length": String(pdf.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function missingReportResponse() {
  return NextResponse.json({ error: "Pemindaian tidak ditemukan atau token akses tidak valid." }, { status: 404, headers: { "Cache-Control": "no-store" } });
}

function isScanId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
