import type { DependencyScanReport } from "./types";

const PAGE_LINES = 48;

export function buildSecurityPdf(report: DependencyScanReport): Buffer {
  const lines: string[] = [
    "InfoCVE - Laporan Pemindaian Dependency",
    `ID pemindaian: ${report.scanId}`,
    `Waktu pemindaian: ${report.scannedAt}`,
    `Status: ${report.status}`,
    `Cakupan: npm | ${report.scope.projectName ?? "Nama proyek tidak tersedia"}`,
    `Dependency: ${report.scope.packageCount} total, ${report.scope.directCount} langsung, ${report.scope.transitiveCount} transitif`,
    `Sumber data: ${report.scope.dataSources.join(", ")}`,
    `Temuan CVE: ${report.findings.filter((finding) => finding.currentDetected).length} terdeteksi saat ini`,
    "",
  ];

  if (report.sourceAttributions?.length) {
    lines.push("Atribusi dan ketentuan sumber:");
    for (const source of report.sourceAttributions) {
      lines.push(`- ${source.sourceName} [${source.rightsReviewStatus ?? "NEEDS_REVIEW"}]: ${source.rightsNote}; sumber: ${source.sourceUrl}; ketentuan: ${source.termsUrl ?? "tidak diketahui; periksa penerbit"}${source.additionalTermsUrl ? `; ketentuan tambahan: ${source.additionalTermsUrl}` : ""}`);
    }
    lines.push("Analisis prioritas dan perintah upgrade diberi label sebagai analisis InfoCVE. Atribusi per-record dan waktu pengambilan berada pada bukti setiap temuan.", "");
  }
  lines.push("CVE® is a registered trademark of The MITRE Corporation. Copyright © The MITRE Corporation; CVE data used under the CVE Program Terms of Use: https://www.cve.org/Legal/TermsOfUse.", "");

  for (const finding of report.findings) {
    lines.push(
      `${finding.cveId} | ${finding.priority} | ${finding.packageName}@${finding.version}`,
      `Tipe dependency: ${finding.direct && finding.transitive ? "langsung dan transitif" : finding.direct ? "langsung" : "transitif"}`,
      `Pencocokan: ${finding.matchStatus} | Verifikasi perbaikan: ${finding.verificationStatus} | Lokasi: ${finding.locations.join(", ")}`,
      `Ringkasan advisori: ${finding.summary ?? "Tidak tersedia"}`,
      `Versi terdampak menurut sumber: ${finding.affectedRanges.join("; ") || "Tidak tersedia"}`,
      `Versi perbaikan menurut sumber: ${finding.fixedVersions.join(", ") || "Tidak tersedia"}`,
      `Langkah upgrade (analisis InfoCVE): ${finding.upgradeCommand ?? "Tidak tersedia"}`,
      `Alasan prioritas InfoCVE: ${finding.priorityReasons.join("; ") || "Tidak tersedia"}`,
      `Mitigasi sementara: ${finding.temporaryMitigation ?? "Tidak tersedia pada data advisori"}`,
      `Konflik sumber: ${finding.sourceConflicts.join("; ") || "Tidak ada yang terdeteksi"}`,
      `Referensi: ${finding.references.map((reference) => `${reference.type}: ${reference.url}`).join(" | ") || "Tidak tersedia"}`,
      ...finding.sourceEvidence.map((source) => `Bukti ${source.source}: ${source.evaluation}; status ketentuan ${source.rightsReviewStatus ?? "NEEDS_REVIEW"}; jenis waktu ${source.observationType ?? "lama/tidak dicatat"}; waktu observasi ${source.fetchedAt}; rentang ${source.affectedRanges.join(", ") || "tidak tersedia"}; alasan: ${source.reason}; ketentuan: ${source.dataRightsNote ?? "tidak dicatat pada scan lama"}; ketentuan URL: ${source.dataRightsUrl ?? "tidak tersedia"}; record OSV: ${source.url ?? "tidak tersedia"}; asal advisori: ${source.originUrl ?? "tidak tersedia"}`),
      ""
    );
  }

  lines.push("Peringatan dan data yang belum lengkap:");
  for (const warning of report.warnings) lines.push(`- ${warning.code}: ${warning.message}`);
  if (report.warnings.length === 0) lines.push("Tidak ada peringatan dari proses pemindaian ini.");
  lines.push("", "Keterbatasan:");
  for (const limitation of report.limitations) lines.push(`- ${limitation}`);
  lines.push("", "Jejak audit:");
  for (const event of report.auditTrail) {
    lines.push(`- ${event.timestamp} | ${event.stage} | ${event.status} | ${event.package ?? ""}${event.version ? `@${event.version}` : ""} ${event.cve ?? ""} | ${event.source ?? ""} | ${event.decision ?? ""} | ${event.reason ?? ""}`);
  }
  if (report.auditTrail.length === 0) lines.push("Jejak audit tidak tersedia pada pemindaian lama ini.");

  const wrapped = lines.flatMap((line) => wrapPdfLine(toPdfText(line), 92));
  const pageLines: string[][] = [];
  for (let index = 0; index < wrapped.length; index += PAGE_LINES) pageLines.push(wrapped.slice(index, index + PAGE_LINES));
  if (pageLines.length === 0) pageLines.push(["InfoCVE - Laporan pemindaian kosong"]);

  const objects: string[] = [];
  const pageObjectIds = pageLines.map((_, index) => 4 + index * 2);
  const contentObjectIds = pageObjectIds.map((id) => id + 1);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  pageLines.forEach((page, index) => {
    const pageId = pageObjectIds[index]!;
    const contentId = contentObjectIds[index]!;
    const textOperators = page.map((line, lineIndex) =>
      `${lineIndex === 0 ? "" : "0 -14 Td "}(${escapePdfString(line)}) Tj`
    ).join("\n");
    const content = `BT /F1 9 Tf 48 760 Td\n${textOperators}\nET`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`;
  });

  let document = "%PDF-1.4\n%InfoCVE\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(document, "latin1");
    document += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(document, "latin1");
  document += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) document += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  document += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document, "latin1");
}

function toPdfText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "?");
}

function wrapPdfLine(value: string, width: number): string[] {
  if (value.length <= width) return [value];
  const words = value.split(/\s+/);
  const output: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && `${current} ${word}`.length > width) {
      output.push(current);
      current = word.slice(0, width);
    } else {
      current = current ? `${current} ${word}` : word;
    }
    while (current.length > width) {
      output.push(current.slice(0, width));
      current = current.slice(width);
    }
  }
  if (current) output.push(current);
  return output;
}

function escapePdfString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
