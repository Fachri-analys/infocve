import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, CalendarDays, Info, Package } from "lucide-react";

import { Breadcrumb } from "@/components/common/breadcrumb";
import { ErrorState } from "@/components/common/error-state";
import { SeverityBadge } from "@/components/cve/severity-badge";
import { CopyCveIdButton } from "@/components/cve/copy-cve-id-button";
import { CVSSCard } from "@/components/cve/cvss-card";
import { CWECard } from "@/components/cve/cwe-card";
import { ReferenceCard } from "@/components/cve/reference-card";
import { Timeline } from "@/components/cve/timeline";
import { EPSSCard } from "@/components/cve/epss-card";
import { CisaKevCard } from "@/components/cve/cisa-kev-card";
import { SourceBadge } from "@/components/cve/source-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCVEById } from "@/lib/nvd";
import { ThreatIntelligenceAggregator } from "@/lib/sources/aggregator";
import { formatDateId, safeJsonLdStringify } from "@/utils/format";

// `generateMetadata` and the page component below both need the same CVE.
// Wrapping the lookup in React's `cache()` — Next's own recommended pattern
// for this exact situation — means it only actually runs once per request
// instead of twice, and removes any ambiguity between the two call sites.
const getCve = cache(async (id: string) => {
  const raw = await getCVEById(id);
  if (!raw) return null;
  return await ThreatIntelligenceAggregator.enrich(raw, true);
});

interface CVEPageProps {
  params: Promise<{ id: string }>;
}

// No generateStaticParams here on purpose: with live NVD data there is no
// fixed, enumerable set of valid IDs to pre-render (unlike the old mock
// dataset). Every CVE page now renders on demand — dynamicParams defaults
// to true, so any syntactically valid ID is looked up live via
// getCVEById(), which returns null (-> notFound()) for IDs NVD confirms
// don't exist, or throws (-> app/error.tsx) if NVD couldn't be reached.

export async function generateMetadata({ params }: CVEPageProps): Promise<Metadata> {
  const { id } = await params;

  // Deliberately swallows failures rather than propagating them: metadata
  // is supplementary, and the page component below (which runs regardless
  // of what happens here) is the single source of truth for whether a
  // request ends in notFound() or the error boundary. Letting a metadata
  // fetch failure influence that would be surprising and hard to reason
  // about — this keeps the two concerns independent.
  try {
    const cve = await getCve(id);
    if (!cve) return { title: "CVE Tidak Ditemukan" };

    return {
      title: `${cve.id} — ${cve.title}`,
      description: cve.descriptionId.slice(0, 155),
      alternates: { canonical: `/cve/${cve.id}` },
      openGraph: {
        title: `${cve.id} — Tingkat ${cve.cvss.severity}`,
        description: cve.descriptionId.slice(0, 155),
      },
      twitter: {
        title: `${cve.id} — Tingkat ${cve.cvss.severity}`,
        description: cve.descriptionId.slice(0, 155),
      },
    };
  } catch {
    return { title: id };
  }
}

export default async function CVEDetailPage({ params }: CVEPageProps) {
  const { id } = await params;

  let cve;
  try {
    cve = await getCve(id);
  } catch {
    // getCve() throws NvdApiError for anything that isn't a confirmed
    // "this ID doesn't exist" (network/timeout/rate-limit/server issues —
    // see lib/nvd.ts). That's normally left to bubble up to app/error.tsx,
    // but is handled explicitly here as well so a transient NVD failure
    // reliably shows the friendly error state on this route regardless.
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <ErrorState />
      </div>
    );
  }

  if (!cve) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: `${cve.id} — ${cve.title}`,
    datePublished: cve.publishedDate,
    dateModified: cve.lastModifiedDate,
    description: cve.descriptionId,
    about: cve.id,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }} />

      <Breadcrumb items={[{ label: "Cari CVE", href: "/search" }, { label: cve.id }]} />

      <Alert variant="info" className="mb-6">
        <Info />
        <AlertDescription>
          Data kerentanan ini diperkaya secara otomatis dari berbagai sumber intelijen resmi:{" "}
          <strong className="text-foreground">NVD (NIST)</strong>, <strong className="text-foreground">CISA KEV</strong>,{" "}
          <strong className="text-foreground">FIRST EPSS</strong>, dan <strong className="text-foreground">GitHub Advisories</strong>.
          Lihat{" "}
          <Link href="/sources" className="underline hover:text-foreground">
            transparansi sumber data
          </Link>{" "}
          untuk metodologi lengkap.
        </AlertDescription>
      </Alert>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="data-tag font-display text-2xl font-medium text-foreground sm:text-3xl">{cve.id}</h1>
            <CopyCveIdButton id={cve.id} />
            {cve.hasPoc && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
                PoC / Exploit Tersedia
              </span>
            )}
          </div>
          <p className="mt-1 text-base text-muted-foreground">{cve.title}</p>
          <div className="mt-3">
            <SourceBadge sources={cve.sources} />
          </div>
        </div>
        <SeverityBadge severity={cve.cvss.severity} size="md" />
      </div>

      <div className="mb-6">
        <CisaKevCard cisaKev={cve.cisaKev} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Deskripsi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Deskripsi Asli (Bahasa Inggris)
                </p>
                <p className="text-sm leading-relaxed text-foreground">{cve.descriptionEn}</p>
              </div>
              <div className="border-t border-border/70 pt-4">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-accent">Penjelasan Bahasa Indonesia</p>
                <p className="text-sm leading-relaxed text-foreground">{cve.descriptionId}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="size-4 text-accent" />
                Produk Terdampak
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cve.affected.map((item) => (
                <div
                  key={`${item.vendor}-${item.product}`}
                  className="flex flex-col gap-1 rounded-xl border border-border bg-surface-hover/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Building2 className="size-3.5 text-muted-foreground" />
                      {item.vendor}
                    </p>
                    <p className="text-sm text-muted-foreground">{item.product}</p>
                  </div>
                  <div className="data-tag flex flex-wrap gap-1.5">
                    {item.versions.map((v) => (
                      <span key={v} className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-foreground">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <CVSSCard cvss={cve.cvss} />
          <EPSSCard epss={cve.epss} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3 pt-5">
              <InfoRow icon={CalendarDays} label="Dipublikasikan" value={formatDateId(cve.publishedDate)} />
              <InfoRow icon={CalendarDays} label="Diperbarui" value={formatDateId(cve.lastModifiedDate)} />
              <InfoRow icon={Building2} label="Vendor" value={cve.vendor} />
              <InfoRow icon={Package} label="Produk" value={cve.product} />
            </CardContent>
          </Card>

          <CWECard items={cve.cwe} />
          <Timeline publishedDate={cve.publishedDate} lastModifiedDate={cve.lastModifiedDate} />
          <ReferenceCard references={cve.references} />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
