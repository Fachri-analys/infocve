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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }} />

      <Breadcrumb items={[{ label: "Cari CVE", href: "/search" }, { label: cve.id }]} />

      <div className="mb-7 border-y border-border bg-surface/35 p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow mb-3 text-[10px]">Detail kerentanan</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="data-tag font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">{cve.id}</h1>
              <CopyCveIdButton id={cve.id} />
              {cve.hasPoc && (
                <span className="rounded-md border border-severity-high/30 bg-severity-high/10 px-2.5 py-0.5 text-xs font-semibold text-severity-high-fg">
                  PoC / Exploit tersedia
                </span>
              )}
            </div>
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">{cve.title}</p>
            <SourceBadge sources={cve.sources} className="mt-4" />
          </div>
          <div className="sm:pt-7">
            <SeverityBadge severity={cve.cvss.severity} size="md" />
          </div>
        </div>
      </div>

      <Alert variant="info" className="mb-7">
        <Info />
        <AlertDescription>
          Data ini diperkaya dari NVD (NIST), CISA KEV, FIRST EPSS, dan GitHub Advisories. Lihat{" "}
          <Link href="/sources" className="font-medium underline underline-offset-2 hover:text-foreground">
            transparansi sumber data
          </Link>{" "}
          untuk metodologi lengkap.
        </AlertDescription>
      </Alert>

      <div className="mb-6">
        <CisaKevCard cisaKev={cve.cisaKev} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <p className="eyebrow text-[10px]">Ringkasan teknis</p>
              <CardTitle className="mt-1">Deskripsi</CardTitle>
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
            <CardContent className="space-y-0">
              {cve.affected.map((item, idx) => (
                <div
                  key={`${item.vendor}-${item.product}-${idx}`}
                  className="flex flex-col gap-1 border-b border-border py-4 first:border-t sm:flex-row sm:items-center sm:justify-between"
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
                      <span key={v} className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground">
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

        <div className="space-y-6 lg:sticky lg:top-24">
          <Card>
            <CardHeader className="pb-3">
              <p className="eyebrow text-[10px]">Ringkasan</p>
              <CardTitle className="mt-1 text-base">Metadata CVE</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border/70 pt-0">
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
    <div className="flex items-start justify-between gap-4 py-3 text-sm first:pt-0 last:pb-0">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className="max-w-[58%] text-right font-medium leading-relaxed text-foreground">{value}</span>
    </div>
  );
}
