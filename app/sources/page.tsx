import type { Metadata } from "next";
import { Database, ShieldAlert, Activity, GitFork, ExternalLink, CheckCircle2 } from "lucide-react";
import { Breadcrumb } from "@/components/common/breadcrumb";
import { buildPageMetadata } from "@/utils/metadata";
import { safeJsonLdStringify } from "@/utils/format";

export const metadata: Metadata = buildPageMetadata({
  title: "Transparansi Sumber Data Intelijen Kerentanan",
  description:
    "Informasi lengkap mengenai sumber data, frekuensi sinkronisasi, metodologi agregasi, dan lisensi feed keamanan siber yang digunakan oleh InfoCVE.",
  path: "/sources",
});

const DATA_SOURCES = [
  {
    id: "NVD",
    name: "National Vulnerability Database (NVD)",
    provider: "National Institute of Standards and Technology (NIST)",
    url: "https://nvd.nist.gov",
    description:
      "Standar data kerentanan resmi pemerintah AS yang memuat CVE Dictionary, skor keparahan CVSS v2.0/v3.x/v4.0, Common Weakness Enumeration (CWE), dan konfigurasi Common Platform Enumeration (CPE).",
    role: "Sumber data utama untuk metadata CVE, deskripsi teknis, skor CVSS resmi, dan relasi vendor/produk.",
    license: "Public Domain (US Government Work)",
    cadence: "Sinkronisasi berkala (1 - 6 jam) via REST API v2.0",
    icon: Database,
    color: "text-blue-500",
  },
  {
    id: "CISA_KEV",
    name: "Known Exploited Vulnerabilities (KEV) Catalog",
    provider: "Cybersecurity and Infrastructure Security Agency (CISA)",
    url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    description:
      "Katalog resmi otoritatif kerentanan yang memiliki bukti konfirmasi telah dieksploitasi secara aktif oleh penyerang siber di lingkungan nyata (in-the-wild).",
    role: "Memberikan status KEV, tenggat waktu remediasi mandat federal (due date), dan rekomendasi tindakan mitigasi darurat.",
    license: "Public Domain (US Federal)",
    cadence: "Diperbarui setiap ada publikasi eksploitasi aktif baru",
    icon: ShieldAlert,
    color: "text-red-500",
  },
  {
    id: "EPSS",
    name: "Exploit Prediction Scoring System (EPSS)",
    provider: "Forum of Incident Response and Security Teams (FIRST.org)",
    url: "https://www.first.org/epss/",
    description:
      "Model statistik berbasis machine learning yang memperkirakan probabilitas suatu CVE akan dieksploitasi dalam 30 hari ke depan, dilengkapi peringkat persentil global.",
    role: "Membantu tim keamanan memprioritaskan patching berdasarkan ancaman nyata, bukan hanya skor keparahan teoretis.",
    license: "Open Data (FIRST.org)",
    cadence: "Diperbarui setiap hari (skor harian global)",
    icon: Activity,
    color: "text-purple-500",
  },
  {
    id: "GHSA",
    name: "GitHub Security Advisories (GHSA)",
    provider: "GitHub Security Lab",
    url: "https://github.com/advisories",
    description:
      "Basis data kerentanan perangkat lunak open-source di berbagai ekosistem paket (npm, PyPI, Maven, Go, Cargo, NuGet, RubyGems, Composer).",
    role: "Menghubungkan CVE dengan dependensi paket open-source, versi terdampak, dan rilis patch perbaikan.",
    license: "Creative Commons Attribution 4.0 International (CC-BY 4.0)",
    cadence: "Sinkronisasi real-time / harian",
    icon: GitFork,
    color: "text-emerald-500",
  },
];

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function SourcesPage() {
  const catalogJsonLd = {
    "@context": "https://schema.org",
    "@type": "DataCatalog",
    name: "Katalog Sumber Data Intelijen Kerentanan InfoCVE",
    description:
      "Katalog resmi sumber data intelijen kerentanan yang digunakan InfoCVE, mencakup NVD NIST, CISA KEV, FIRST EPSS, dan GHSA.",
    url: `${siteUrl}/sources`,
    dataset: DATA_SOURCES.map((s) => ({
      "@type": "Dataset",
      name: s.name,
      description: s.description,
      license: s.license,
      creator: {
        "@type": "Organization",
        name: s.provider,
        url: s.url,
      },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Beranda", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Sumber Data", item: `${siteUrl}/sources` },
    ],
  };

  const primarySource = DATA_SOURCES.find((source) => source.id === "NVD");
  const supportingSources = DATA_SOURCES.filter((source) => source.id !== "NVD");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(catalogJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbJsonLd) }} />
      <Breadcrumb items={[{ label: "Sumber Data" }]} />

      <header className="mb-12 grid gap-8 border-b border-border pb-8 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-end sm:pb-10">
        <div>
          <p className="eyebrow mb-4 text-[10px]">Jejak data / InfoCVE</p>
          <h1 className="content-heading max-w-4xl font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Setiap temuan punya <span className="text-accent">sumber.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            Telusuri asal metadata CVE, sinyal eksploitasi, dan skor probabilitas yang membantu memberi konteks pada setiap kerentanan.
          </p>
        </div>
        <div className="flex items-end gap-4 border-l-2 border-accent pl-4 sm:justify-end">
          <span className="data-tag text-5xl font-medium leading-none text-accent">{String(DATA_SOURCES.length).padStart(2, "0")}</span>
          <span className="max-w-20 pb-1 text-xs leading-5 text-muted-foreground">sumber data yang dirujuk</span>
        </div>
      </header>

      {primarySource && (
        <section aria-labelledby="primary-source-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="eyebrow text-[10px]">Sumber primer / 01</p>
            <span className="data-tag text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Data inti CVE</span>
          </div>
          <article className="editorial-panel navy-panel border border-border">
            <div className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:p-10">
              <div>
                <div className="mb-5 flex items-center gap-3">
                  <span className="data-tag border border-accent/30 px-2 py-1 text-xs text-accent">{primarySource.id}</span>
                  <primarySource.icon className={`size-5 ${primarySource.color}`} aria-hidden="true" />
                </div>
                <h2 id="primary-source-title" className="max-w-3xl font-display text-3xl font-medium leading-tight tracking-tight text-foreground sm:text-4xl">
                  {primarySource.name}
                </h2>
                <p className="mt-2 text-xs font-medium text-muted-foreground">{primarySource.provider}</p>
                <p className="mt-5 max-w-3xl text-sm leading-7 text-muted-foreground">
                  {primarySource.description}
                </p>
                <a
                  href={primarySource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 border-b border-accent/50 pb-1 text-sm font-medium text-accent transition-colors hover:border-accent hover:text-foreground"
                >
                  Kunjungi situs resmi
                  <ExternalLink className="size-3.5" />
                </a>
              </div>

              <dl className="grid gap-4 border-t border-border pt-5 text-sm lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
                <div>
                  <dt className="eyebrow text-[9px]">Peran di InfoCVE</dt>
                  <dd className="mt-2 leading-6 text-foreground">{primarySource.role}</dd>
                </div>
                <div className="border-t border-border pt-4">
                  <dt className="eyebrow text-[9px]">Pembaruan</dt>
                  <dd className="mt-2 leading-6 text-muted-foreground">{primarySource.cadence}</dd>
                </div>
                <div className="border-t border-border pt-4">
                  <dt className="eyebrow text-[9px]">Lisensi</dt>
                  <dd className="mt-2 flex items-start gap-2 leading-5 text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                    {primarySource.license}
                  </dd>
                </div>
              </dl>
            </div>
          </article>
        </section>
      )}

      <section aria-labelledby="supporting-sources-title" className="mt-12">
        <header className="mb-5 flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow mb-2 text-[10px]">Sinyal pelengkap / 02—04</p>
            <h2 id="supporting-sources-title" className="font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Lapisan intelijen tambahan
            </h2>
          </div>
          <p className="max-w-sm text-xs leading-5 text-muted-foreground">Eksploitasi aktif, peluang eksploitasi, dan advisori ekosistem open-source.</p>
        </header>

        <div className="grid grid-cols-1 border-y border-border md:grid-cols-3 md:divide-x md:divide-border">
          {supportingSources.map((source, index) => {
            const Icon = source.icon;
            return (
              <article key={source.id} className="group flex flex-col border-b border-border py-6 transition-colors hover:bg-surface-hover/40 md:border-b-0 md:px-5 md:py-7 first:md:pl-0 last:md:pr-0">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span className="data-tag text-xs text-muted-foreground">0{index + 2} / {source.id}</span>
                  <Icon className={`size-5 transition-transform duration-200 group-hover:-translate-y-0.5 ${source.color}`} aria-hidden="true" />
                </div>
                <h3 className="font-display text-xl font-medium leading-snug tracking-tight text-foreground">{source.name}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{source.provider}</p>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{source.description}</p>

                <div className="mt-5 border-t border-border pt-4">
                  <p className="eyebrow text-[9px]">Peran di InfoCVE</p>
                  <p className="mt-2 text-xs leading-5 text-foreground">{source.role}</p>
                </div>

                <dl className="mt-auto grid gap-3 pt-5">
                  <div className="border-t border-border pt-3">
                    <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Pembaruan</dt>
                    <dd className="mt-1 text-xs leading-5 text-foreground">{source.cadence}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Lisensi data</dt>
                    <dd className="mt-1 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                      {source.license}
                    </dd>
                  </div>
                </dl>

                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex w-fit items-center gap-1.5 border-b border-border pb-1 text-xs font-medium text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                >
                  Sumber resmi <ExternalLink className="size-3" />
                </a>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
