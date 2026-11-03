import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Database, ShieldCheck, Calendar, ArrowRight } from "lucide-react";
import { Breadcrumb } from "@/components/common/breadcrumb";
import { buildPageMetadata } from "@/utils/metadata";
import { getDashboardData } from "@/lib/dashboard-stats";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { SeverityChart } from "@/components/dashboard/severity-chart";
import { PriorityBreakdown } from "@/components/dashboard/priority-breakdown";
import { ThreatIntelSummary } from "@/components/dashboard/threat-intel-summary";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { TopRankings } from "@/components/dashboard/top-rankings";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Stream the dashboard shell while aggregated catalog data loads.
export const revalidate = 0;

export const metadata: Metadata = buildPageMetadata({
  title: "Dashboard Vulnerability & Intelijen Ancaman",
  description:
    "Statistik intelijen kerentanan aktual InfoCVE: distribusi keparahan CVSS, eksploitasi aktif CISA KEV, probabilitas EPSS, top vendor/produk/CWE, dan rekomendasi prioritas remediasi.",
  path: "/dashboard",
});

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 animate-fade-in">
      <Breadcrumb items={[{ label: "Dashboard" }]} />

      <header className="navy-panel mb-8 grid gap-7 border border-border p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-end">
        <div className="max-w-3xl">
          <p className="eyebrow mb-4 text-[10px]">
            <span aria-hidden="true" className="inline-flex size-2 bg-accent" />
            Intelijen Kerentanan
          </p>
          <h1 className="content-heading font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Risiko siber, terbaca lebih jelas.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            Ringkasan analitik kerentanan dari National Vulnerability Database (NVD), katalog eksploitasi CISA KEV,
            dan skor probabilitas EPSS dari FIRST.org.
          </p>
        </div>

        <div className="flex gap-4 border-t border-border pt-4 sm:items-center lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <Calendar className="mt-1 size-4 shrink-0 text-accent" />
          <div>
            <p className="eyebrow text-[10px]">Sumber Analisis</p>
            <p className="data-tag mt-2 text-lg font-medium text-foreground">Katalog tersinkron</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Backfill awal 120 hari, dilanjutkan pembaruan inkremental NVD.</p>
          </div>
        </div>
      </header>

      <Suspense fallback={<DashboardContentFallback />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  const data = await getDashboardData();
  if (!data.dataAvailable) {
    return (
      <section role="status" className="navy-panel border border-border p-6 sm:p-8">
        <p className="eyebrow text-[10px] text-accent">Data analitik belum tersedia</p>
        <h2 className="mt-3 font-display text-2xl font-medium text-foreground">Katalog CVE belum tersedia</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Ringkasan statistik belum dapat dihitung karena katalog kosong atau belum bisa diakses. Periksa status sinkronisasi dan koneksi database, lalu coba lagi.
        </p>
        <Link href="/search" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-accent underline-offset-4 hover:underline">
          Buka pencarian CVE <ArrowRight className="size-4" />
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-10">
      <section aria-label="Metrik Utama">
        <KpiCards data={data} />
      </section>

      <section aria-label="Distribusi Keparahan">
        <SeverityChart severityDistribution={data.severityDistribution} brackets={data.cvssStats.brackets} totalCves={data.totalSampleCves} />
      </section>

      <section aria-label="Hierarki Prioritas InfoCVE">
        <PriorityBreakdown priorityStats={data.priorityStats} />
      </section>

      <section aria-label="Intelijen Eksploitasi Nyata">
        <ThreatIntelSummary cisaKevStats={data.cisaKevStats} epssStats={data.epssStats} />
      </section>

      {data.trend.length > 0 && (
        <section aria-label="Tren Publikasi">
          <TrendChart trend={data.trend} />
        </section>
      )}

      <section aria-label="Peringkat Entitas Terdampak">
        <TopRankings topVendors={data.topVendors} topProducts={data.topProducts} topCwes={data.topCwes} />
      </section>

      <div className="navy-panel border border-border p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="size-4 text-accent" />
              Transparansi Sumber &amp; Metodologi Intelijen
            </h3>
            <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
              Seluruh statistik di dashboard ini bersumber langsung dari API resmi tanpa manipulasi atau data dummy.
              InfoCVE memprioritaskan tindakan berdasarkan kombinasi keparahan teknis (CVSS) dan ancaman eksploitasi
              nyata (CISA KEV &amp; EPSS).
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/sources" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted">
              <Database className="size-3.5" />
              Audit Sumber Data
              <ArrowRight className="size-3" />
            </Link>
            <Link href="/search" className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/90">
              Cari Semua Kerentanan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardContentFallback() {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Memuat analitik dashboard">
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="rounded-none border-0">
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="space-y-4 p-6">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-40 w-full" />
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-28 w-full" />
        </Card>
        <Card className="space-y-4 p-6">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-28 w-full" />
        </Card>
      </div>
    </div>
  );
}
