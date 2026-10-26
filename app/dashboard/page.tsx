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

export const revalidate = 21600; // 6 hours, matching NVD facet-sample cache window

export const metadata: Metadata = buildPageMetadata({
  title: "Dashboard Vulnerability & Intelijen Ancaman",
  description:
    "Statistik intelijen kerentanan aktual InfoCVE: distribusi keparahan CVSS, eksploitasi aktif CISA KEV, probabilitas EPSS, top vendor/produk/CWE, dan rekomendasi prioritas remediasi.",
  path: "/dashboard",
});

export default async function DashboardPage() {
  const data = await getDashboardData();

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
            <p className="eyebrow text-[10px]">Rentang Analisis</p>
            <p className="data-tag mt-2 text-lg font-medium text-foreground">120 hari terakhir</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Sampel NVD untuk ringkasan metrik.</p>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <div className="space-y-10">
        {/* KPI Cards Section */}
        <section aria-label="Metrik Utama">
          <KpiCards data={data} />
        </section>

        {/* Severity and Score Distribution */}
        <section aria-label="Distribusi Keparahan">
          <SeverityChart
            severityDistribution={data.severityDistribution}
            brackets={data.cvssStats.brackets}
            totalCves={data.totalSampleCves}
          />
        </section>

        {/* InfoCVE Priority Methodology Breakdown */}
        <section aria-label="Hierarki Prioritas InfoCVE">
          <PriorityBreakdown
            priorityStats={data.priorityStats}
          />
        </section>

        {/* Real-World Threat Intelligence (CISA KEV + EPSS) */}
        <section aria-label="Intelijen Eksploitasi Nyata">
          <ThreatIntelSummary
            cisaKevStats={data.cisaKevStats}
            epssStats={data.epssStats}
          />
        </section>

        {/* Weekly Trend Chart */}
        {data.trend.length > 0 && (
          <section aria-label="Tren Publikasi">
            <TrendChart trend={data.trend} />
          </section>
        )}

        {/* Top Vendors, Products, and CWEs */}
        <section aria-label="Peringkat Entitas Terdampak">
          <TopRankings
            topVendors={data.topVendors}
            topProducts={data.topProducts}
            topCwes={data.topCwes}
          />
        </section>

        {/* Methodology & Data Provenance Notice */}
        <div className="navy-panel border border-border p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="size-4 text-accent" />
                Transparansi Sumber &amp; Metodologi Intelijen
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
                Seluruh statistik di dashboard ini bersumber langsung dari API resmi tanpa manipulasi atau data dummy.
                InfoCVE memprioritaskan tindakan berdasarkan kombinasi keparahan teknis (CVSS) dan ancaman eksploitasi
                nyata (CISA KEV &amp; EPSS).
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link
                href="/sources"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Database className="size-3.5" />
                Audit Sumber Data
                <ArrowRight className="size-3" />
              </Link>
              <Link
                href="/search"
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/90"
              >
                Cari Semua Kerentanan
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
