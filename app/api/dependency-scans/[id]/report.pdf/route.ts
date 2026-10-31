import { authorizedReport, missingReportResponse, pdfReportResponse } from "@/lib/scanner/report-http";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const report = authorizedReport(request, id);
  return report ? pdfReportResponse(report) : missingReportResponse();
}
