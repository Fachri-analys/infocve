"use client";

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, CircleHelp, FileJson2, LoaderCircle, RotateCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DependencyScanReport } from "@/lib/scanner/types";
import { FileInput } from "./file-input";
import { ScanResults } from "./scan-results";

const HISTORY_KEY = "infocve-scan-history";
const TOKEN_PREFIX = "infocve-scan-token:";

interface ScanResponse {
  report?: DependencyScanReport;
  accessToken?: string;
  error?: string;
}
export function DependencyScanner() {
  const [manifestFile, setManifestFile] = useState<File | null>(null);
  const [lockFile, setLockFile] = useState<File | null>(null);
  const [report, setReport] = useState<DependencyScanReport | null>(null);
  const [historyIds, setHistoryIds] = useState<string[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadScan = useCallback(async (scanId: string) => {
    const token = sessionStorage.getItem(`${TOKEN_PREFIX}${scanId}`);
    if (!token) {
      setError("Token akses riwayat ini tidak ditemukan di sesi browser.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/dependency-scans/${scanId}`, { headers: { "x-scan-token": token }, cache: "no-store" });
      const payload = await response.json() as ScanResponse;
      if (!response.ok || !payload.report) throw new Error(payload.error ?? "Riwayat pemindaian tidak dapat dimuat.");
      setReport(payload.report);
      setSelectedHistoryId(scanId);
      setNotice("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Riwayat pemindaian tidak dapat dimuat.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let frame = 0;
    try {
      const ids = JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? "[]") as unknown;
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) return;
      const savedIds = ids.slice(0, 10) as string[];
      frame = window.requestAnimationFrame(() => {
        setHistoryIds(savedIds);
        if (savedIds[0]) void loadScan(savedIds[0]);
      });
    } catch {
      sessionStorage.removeItem(HISTORY_KEY);
    }
    return () => window.cancelAnimationFrame(frame);
  }, [loadScan]);

  function onFileChange(event: ChangeEvent<HTMLInputElement>, setFile: (file: File | null) => void) {
    setFile(event.target.files?.[0] ?? null);
    setError("");
  }

  async function submitScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manifestFile || !lockFile || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = new FormData();
      body.set("packageJson", manifestFile);
      body.set("packageLockJson", lockFile);
      const isRescan = Boolean(report);
      const token = isRescan && report ? sessionStorage.getItem(`${TOKEN_PREFIX}${report.scanId}`) : null;
      const endpoint = isRescan && report
        ? `/api/dependency-scans/${report.scanId}/rescan`
        : "/api/dependency-scans";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: token ? { "x-scan-token": token } : undefined,
        body,
      });
      const payload = await response.json() as ScanResponse;
      if (!response.ok || !payload.report || !payload.accessToken) throw new Error(payload.error ?? "Pemindaian tidak berhasil.");

      const nextReport = payload.report;
      sessionStorage.setItem(`${TOKEN_PREFIX}${nextReport.scanId}`, payload.accessToken);
      const ids = [nextReport.scanId, ...historyIds.filter((id) => id !== nextReport.scanId)].slice(0, 10);
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(ids));
      setHistoryIds(ids);
      setSelectedHistoryId(nextReport.scanId);
      setReport(nextReport);
      setNotice(isRescan ? "Pemindaian baru tersimpan dan hasilnya dibandingkan dengan riwayat yang dipilih." : "Pemindaian selesai dan riwayat tersimpan untuk sesi browser ini.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pemindaian tidak berhasil.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadReport(format: "json" | "pdf") {
    if (!report) return;
    const token = sessionStorage.getItem(`${TOKEN_PREFIX}${report.scanId}`);
    if (!token) {
      setError("Token laporan tidak ditemukan di sesi browser.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/dependency-scans/${report.scanId}/report.${format}`, {
        headers: { "x-scan-token": token },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Laporan tidak dapat diunduh.");
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `infocve-${report.scanId}.${format}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Laporan tidak dapat diunduh.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 animate-fade-in">
      <div className="mb-8 max-w-3xl">
        <p className="eyebrow mb-3 text-[10px]">Keamanan rantai pasok · npm</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">Pindai dependency, pahami risikonya.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          Unggah manifest dan lockfile untuk memeriksa dependency langsung maupun transitif terhadap advisori CVE. File dibaca sebagai JSON; kode di dalamnya tidak dijalankan.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="upload-title" className="space-y-6">
          <Card className="border-t-2 border-t-accent">
            <CardHeader>
              <p className="eyebrow text-[10px]">Pemindaian statis</p>
              <CardTitle id="upload-title" className="mt-1">Pilih dua file npm</CardTitle>
              <p className="text-sm leading-relaxed text-muted-foreground">Gunakan file dari commit atau rilis yang sama agar versi terpasang sesuai dengan proyek.</p>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={submitScan}>
                <FileInput id="manifest-file" label="package.json" description="Manifest rentang dependency" file={manifestFile} onChange={(event) => onFileChange(event, setManifestFile)} />
                <FileInput id="lock-file" label="package-lock.json" description="Versi aktual dan struktur dependency" file={lockFile} onChange={(event) => onFileChange(event, setLockFile)} />
                <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
                  <Button type="submit" disabled={!manifestFile || !lockFile || busy}>
                    {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : report ? <RotateCcw aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
                    {busy ? "Memindai…" : report ? "Pindai ulang & verifikasi" : "Mulai pemindaian"}
                  </Button>
                  <span className="text-xs text-muted-foreground">Maksimum 1 MB per file, 2 MB total.</span>
                </div>
              </form>
            </CardContent>
          </Card>

          {error && <div className="flex gap-3 rounded-lg border border-severity-high/30 bg-severity-high/10 p-4 text-sm text-foreground" role="alert"><AlertCircle className="mt-0.5 size-4 shrink-0 text-severity-high-fg" /><p>{error}</p></div>}
          {notice && <div className="flex gap-3 rounded-lg border border-border bg-surface p-4 text-sm text-foreground" role="status"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" /><p>{notice}</p></div>}

          {report && <ScanResults report={report} busy={busy} onDownload={downloadReport} />}
        </section>

        <aside className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <p className="eyebrow text-[10px]">Cakupan awal</p>
              <CardTitle className="mt-1 text-base">Yang diperiksa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>Dependency langsung dan transitif yang tercatat dalam lockfile.</p>
              <p>Versi package dibandingkan dengan rentang terdampak dari OSV.dev.</p>
              <p>Advisori tanpa alias CVE atau versi yang tak bisa dipastikan tidak ditandai sebagai temuan terkonfirmasi.</p>
            </CardContent>
          </Card>

          {historyIds.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><p className="eyebrow text-[10px]">Penyimpanan lokal server</p><CardTitle className="mt-1 text-base">Riwayat sesi</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {historyIds.map((id) => (
                  <Button key={id} type="button" variant={selectedHistoryId === id ? "subtle" : "ghost"} className="h-auto w-full justify-start px-2 py-2 text-left text-xs data-tag" disabled={busy} onClick={() => void loadScan(id)}>
                    <FileJson2 aria-hidden="true" /> {id.slice(0, 8)} · {selectedHistoryId === id ? "terpilih" : "buka"}
                  </Button>
                ))}
                <p className="pt-2 text-xs leading-relaxed text-muted-foreground">ID dan token akses disimpan di sessionStorage pada tab ini. Riwayat server hanya dapat dibuka dengan token tersebut.</p>
              </CardContent>
            </Card>
          )}

          <div className="border-l border-border pl-4 text-xs leading-relaxed text-muted-foreground">
            <CircleHelp className="mb-2 size-4 text-accent" aria-hidden="true" />
            Tidak ada file mentah yang disimpan. Metadata hasil scan disimpan untuk pemindaian ulang, verifikasi, dan laporan.
          </div>
        </aside>
      </div>
    </div>
  );
}
