import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DependencyFinding, DependencyScanReport } from "@/lib/scanner/types";

export function ScanResults({ report, busy, onDownload }: { report: DependencyScanReport; busy: boolean; onDownload: (format: "json" | "pdf") => void }) {
  const title = report.status === "COMPLETED" ? "Pemindaian selesai" : report.status === "COMPLETED_WITH_WARNINGS" ? "Selesai dengan peringatan" : report.status === "INCOMPLETE" ? "Hasil belum lengkap" : "Pemindaian gagal";
  const detectedCount = report.findings.filter((finding) => finding.currentDetected).length;
  return (
    <section aria-labelledby="results-title" className="space-y-5">
      <Card className="navy-panel">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-[10px]">Hasil · {new Date(report.scannedAt).toLocaleString("id-ID")}</p>
              <CardTitle id="results-title" className="mt-1 text-xl">{title}</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">{report.scope.packageCount} package · {report.scope.directCount} langsung · {report.scope.transitiveCount} transitif · {detectedCount} CVE terdeteksi</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onDownload("json")}>JSON</Button>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onDownload("pdf")}>PDF</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {report.status === "COMPLETED" && detectedCount === 0 && (
            <p className="rounded-md border border-accent/20 bg-accent/5 p-3 text-sm text-foreground" role="status">Pemindaian berhasil tanpa temuan CVE pada cakupan yang diperiksa. Hasil ini bukan bukti bahwa aplikasi sepenuhnya aman.</p>
          )}
          {report.status === "FAILED" && <p className="rounded-md border border-severity-high/30 bg-severity-high/10 p-3 text-sm text-foreground" role="alert">Data tidak cukup untuk menyimpulkan hasil. Periksa error API dan coba pindai ulang.</p>}
          {report.status === "INCOMPLETE" && <p className="rounded-md border border-severity-medium/30 bg-severity-medium/10 p-3 text-sm text-foreground">Sebagian cakupan atau sumber gagal diperiksa. Temuan dan ketiadaan temuan belum dapat dianggap lengkap.</p>}
          {report.status === "COMPLETED_WITH_WARNINGS" && <p className="rounded-md border border-severity-medium/30 bg-severity-medium/10 p-3 text-sm text-foreground">Pemindaian selesai, tetapi ada kandidat yang perlu ditinjau atau informasi sumber yang tidak dapat dipastikan.</p>}
        </CardContent>
      </Card>

      {report.findings.map((finding) => <FindingCard key={finding.key} finding={finding} />)}

      {(report.warnings.length > 0 || report.limitations.length > 0) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Peringatan dan keterbatasan</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            {report.warnings.map((warning, index) => <p key={`${warning.code}-${index}`}><span className="font-medium text-foreground">{warning.code}:</span> {warning.message}</p>)}
            {report.limitations.map((limitation) => <p key={limitation}>• {limitation}</p>)}
          </CardContent>
        </Card>
      )}

      {report.sourceAttributions && report.sourceAttributions.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Atribusi dan ketentuan sumber</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-xs leading-relaxed">
            {report.sourceAttributions.map((source, index) => <div key={`${source.sourceId}-${source.sourceUrl}-${index}`} className="border-t border-border pt-3 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">{source.sourceName}</p>
                <span className={`rounded border px-2 py-0.5 text-[10px] font-medium ${source.rightsReviewStatus === "TERMS_IDENTIFIED" ? "border-accent/30 text-accent" : "border-severity-medium/30 text-severity-medium"}`}>{source.rightsReviewStatus === "TERMS_IDENTIFIED" ? "Ketentuan teridentifikasi" : "Needs Review"}</span>
              </div>
              <p className="mt-1 text-muted-foreground">{source.rightsNote}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">Sumber / record</a>
                {source.termsUrl && <a href={source.termsUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">Ketentuan resmi</a>}
                {source.additionalTermsUrl && <a href={source.additionalTermsUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">CVE Program Terms</a>}
              </div>
            </div>)}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function FindingCard({ finding }: { finding: DependencyFinding }) {
  const statusText = finding.verificationStatus === "RESOLVED" ? "Resolved" : finding.verificationStatus === "STILL_DETECTED" ? "Still Detected" : "Unverified";
  const matchText = finding.matchStatus === "CONFIRMED" ? "Confirmed" : finding.matchStatus === "NEEDS_REVIEW" ? "Needs Review" : "Unverified";
  const borderTone = finding.currentDetected ? finding.matchStatus === "CONFIRMED" ? "border-l-severity-high" : "border-l-severity-medium" : "border-l-border";
  return (
    <Card className={`border-l-2 ${finding.verificationStatus === "RESOLVED" ? "border-l-accent" : borderTone}`}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="data-tag text-sm font-medium text-accent">{finding.cveId}</p>
            <CardTitle className="mt-1 break-all text-base">{finding.packageName}@{finding.version}</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-border px-2 py-1 text-xs font-semibold text-foreground">{finding.priority}</span>
            <span className="rounded border border-border px-2 py-1 text-xs text-muted-foreground">{matchText}</span>
            <span className="rounded border border-border px-2 py-1 text-xs text-muted-foreground">{statusText}</span>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{finding.direct && finding.transitive ? "Dependency langsung dan transitif" : finding.direct ? "Dependency langsung" : "Dependency transitif"} · {finding.locations.join(", ")}</p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!finding.currentDetected && <p className="rounded-md border border-severity-medium/30 bg-severity-medium/10 p-3 text-xs leading-relaxed text-foreground">OSV mengembalikan kandidat ini, tetapi bukti identitas atau versi belum mengonfirmasi bahwa instalasi ini terdampak. Kandidat tidak dihitung sebagai temuan terdeteksi.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Info label="Ringkasan pada record advisori OSV" value={finding.summary ?? "Tidak tersedia pada data advisori yang diterima."} />
          <Info label="Versi terdampak menurut sumber" value={finding.affectedRanges.join(", ") || "Tidak tersedia atau belum dapat dipastikan."} />
          <Info label="Versi perbaikan menurut sumber" value={finding.fixedVersions.join(", ") || "Tidak tersedia pada data yang diterima."} />
          <Info label="Severity dari OSV" value={finding.severity ?? "Tidak tersedia."} />
          <Info label="Mitigasi sementara" value={finding.temporaryMitigation ?? "Tidak tersedia pada data advisori yang diterima."} />
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Analisis InfoCVE · prioritas {finding.priority}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{finding.prioritySource}. Prioritas ini adalah triase, bukan tingkat keparahan resmi.</p>
          {finding.priorityReasons.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">{finding.priorityReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
          {finding.upgradeCommand && <p className="data-tag mt-2 overflow-x-auto rounded bg-background px-2 py-1.5 text-xs text-foreground">{finding.upgradeCommand}</p>}
        </div>
        {finding.sourceConflicts.length > 0 && <div className="rounded-md border border-severity-medium/30 bg-severity-medium/10 p-3 text-xs leading-relaxed text-foreground" role="status">Konflik sumber: {finding.sourceConflicts.join(" ")}</div>}
        <details className="group rounded-md border border-border px-3 py-2">
          <summary className="cursor-pointer list-none font-medium text-foreground">Bukti sumber dan keputusan pencocokan ({finding.sourceEvidence.length}) <span className="text-accent group-open:hidden">+</span><span className="hidden text-accent group-open:inline">−</span></summary>
          <div className="mt-3 space-y-3">
            {finding.sourceEvidence.map((evidence, index) => <div key={`${evidence.source}-${evidence.advisoryId}-${index}`} className="border-l border-border pl-3 text-xs leading-relaxed">
              <p className="font-medium text-foreground">{evidence.source} · {evidence.evaluation}</p>
              <p className="text-muted-foreground">Status ketentuan: {evidence.rightsReviewStatus === "TERMS_IDENTIFIED" ? "Ketentuan teridentifikasi" : "Needs Review"}</p>
              <p className="text-muted-foreground">{formatObservationTime(evidence)}{evidence.updatedAt ? ` · diperbarui sumber ${formatSourceTime(evidence.updatedAt)}` : ""}</p>
              {evidence.affectedRanges.length > 0 && <p className="text-muted-foreground">Rentang: {evidence.affectedRanges.join(", ")}</p>}
              <p className="text-muted-foreground">{evidence.reason}</p>
              {evidence.dataRightsNote && <p className="text-muted-foreground">Ketentuan: {evidence.dataRightsNote}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {evidence.url && <a href={evidence.url} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">Buka sumber</a>}
                {evidence.originUrl && <a href={evidence.originUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">Asal record menurut OSV</a>}
                {evidence.dataRightsUrl && <a href={evidence.dataRightsUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">Ketentuan resmi</a>}
              </div>
            </div>)}
            {finding.sourceEvidence.length === 0 && <p className="text-xs text-muted-foreground">Bukti sumber tidak tersedia pada pemindaian lama ini.</p>}
          </div>
        </details>
        {finding.advisoryDetails && <details className="group rounded-md border border-border px-3 py-2">
          <summary className="cursor-pointer list-none font-medium text-foreground">Baca detail advisori <span className="text-accent group-open:hidden">+</span><span className="hidden text-accent group-open:inline">−</span></summary>
          <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{finding.advisoryDetails}</p>
        </details>}
        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3">
          {finding.references.map((reference) => <a key={`${reference.type}-${reference.url}`} href={reference.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent underline-offset-4 hover:underline">{reference.type === "ADVISORY" ? "Advisori eksternal" : reference.type === "VENDOR_ADVISORY" ? "Advisori vendor" : reference.type === "GITHUB_SECURITY_ADVISORIES" ? "GitHub Advisory" : reference.type === "OSV" ? "Record OSV" : reference.type} <ArrowUpRight className="size-3" aria-hidden="true" /></a>)}
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="leading-relaxed text-foreground">{value}</p></div>;
}

function formatSourceTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "waktu tidak tersedia" : date.toLocaleString("id-ID");
}

function formatObservationTime(evidence: DependencyFinding["sourceEvidence"][number]): string {
  const timestamp = formatSourceTime(evidence.fetchedAt);
  switch (evidence.observationType) {
    case "ADVISORY_RESPONSE": return `Respons record ${evidence.source} diterima ${timestamp}`;
    case "LOCAL_SNAPSHOT": return `Snapshot lokal diperiksa ${timestamp}`;
    case "REFERENCE_ONLY": return `URL referensi ditemukan ${timestamp}; halaman vendor tidak diambil`;
    case "SOURCE_NOT_QUERIED": return `Sumber tidak dapat dibandingkan; scan dicatat ${timestamp}`;
    case "SOURCE_LOOKUP_NO_RECORD": return `Lookup sumber dilakukan ${timestamp}; record tidak diterima`;
    default: return `Waktu observasi ${timestamp}`;
  }
}
