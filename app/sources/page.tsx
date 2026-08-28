import type { Metadata } from "next";
import { Database, ShieldAlert, Activity, GitFork, ExternalLink, CheckCircle2 } from "lucide-react";
import { Breadcrumb } from "@/components/common/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildPageMetadata } from "@/utils/metadata";

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

export default function SourcesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: "Sumber Data" }]} />

      <div className="mb-10">
        <h1 className="font-display text-2xl font-medium text-foreground sm:text-4xl">
          Transparansi & Metodologi Sumber Data
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          InfoCVE berkomitmen pada keterbukaan penuh terhadap asal-usul (provenance) dan integritas data intelijen kerentanan yang kami sajikan.
        </p>
      </div>

      <div className="space-y-6">
        {DATA_SOURCES.map((source) => {
          const Icon = source.icon;
          return (
            <Card key={source.id} className="border-border">
              <CardHeader>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2.5 text-lg">
                    <Icon className={`size-5 ${source.color}`} />
                    {source.name}
                  </CardTitle>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-accent"
                  >
                    Kunjungi Situs Resmi
                    <ExternalLink className="size-3" />
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">Penyedia: <strong className="text-foreground">{source.provider}</strong></p>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 text-sm">
                <p className="leading-relaxed text-foreground">{source.description}</p>

                <div className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-surface-hover/30 p-3 sm:grid-cols-2">
                  <div>
                    <span className="text-xs font-semibold text-accent">Peran di InfoCVE</span>
                    <p className="mt-0.5 text-xs text-muted-foreground">{source.role}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-accent">Frekuensi Pembaruan</span>
                    <p className="mt-0.5 text-xs text-muted-foreground">{source.cadence}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span>Lisensi Data: {source.license}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
