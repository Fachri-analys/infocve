import Link from "next/link";
import { ArrowRight, ArrowUpRight, Database } from "lucide-react";

import { SearchBar } from "@/components/search/search-bar";
import { CVECard } from "@/components/cve/cve-card";
import { CategoryCard } from "@/components/cve/category-card";
import { Button } from "@/components/ui/button";
import {
  getCategories,
  getCriticalCVEs,
  getHighCVEs,
  getLatestCVEs,
  getProducts,
  getStats,
  getVendors,
} from "@/lib/nvd";
import { glossaryTerms } from "@/lib/glossary-data";
import { formatNumberId, safeJsonLdStringify, truncate } from "@/utils/format";
import { SITE_DESCRIPTION, SITE_NAME } from "@/utils/constants";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function HomePage() {
  const [latest, critical, high, vendors, products, categories, stats] = await Promise.all([
    getLatestCVEs(6),
    getCriticalCVEs(4),
    getHighCVEs(4),
    getVendors(10),
    getProducts(10),
    getCategories(),
    getStats(),
  ]);
  const featuredTerms = glossaryTerms.slice(0, 4);

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl,
    description: SITE_DESCRIPTION,
    inLanguage: "id-ID",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: siteUrl,
    logo: `${siteUrl}/icon.svg`,
    description: SITE_DESCRIPTION,
  };

  return (
    <div className="min-h-full">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(websiteJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(organizationJsonLd) }} />

      {/* HERO */}
      <section className="home-hero navy-panel border-b border-border">
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-20 lg:px-8 lg:py-24 animate-fade-up">
          <div className="max-w-4xl">
            <p className="eyebrow mb-6 text-[10px]">
              <span aria-hidden="true" className="inline-flex size-2 bg-accent" />
              Basis pengetahuan kerentanan
            </p>
            <h1 className="content-heading max-w-4xl font-display text-[2.75rem] font-medium leading-[1.02] tracking-[-0.045em] text-foreground sm:text-6xl lg:text-[4.75rem]">
              Kenali celahnya.
              <br className="hidden sm:block" />
              {" "}
              <span className="text-accent">Pahami risikonya.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Telusuri CVE berdasarkan ID, vendor, produk, atau kata kunci. Baca penjelasan dalam Bahasa Indonesia,
              lalu nilai urgensinya dari CVSS, EPSS, dan CISA KEV.
            </p>

            <div className="home-search mt-8 max-w-3xl">
              <SearchBar size="lg" appearance="hero" />
              <p className="mt-3 text-xs text-muted-foreground">
                Contoh: <span className="data-tag text-foreground">CVE-2021-44228</span>, vendor, atau nama produk
              </p>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm">
              <Link href="/search?severity=CRITICAL" className="inline-flex items-center gap-1.5 text-foreground underline-offset-4 transition-colors hover:text-accent hover:underline">
                Jelajahi CVE kritis <ArrowUpRight className="size-3.5" />
              </Link>
              <Link href="/glossary" className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">
                Pelajari istilah <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </div>

          <aside aria-label="Ringkasan cakupan data" className="self-end border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div className="flex items-center justify-between gap-4">
              <p className="eyebrow text-[10px]">Cakupan NVD</p>
              <span className="data-tag text-[10px] text-muted-foreground">120 HARI</span>
            </div>
            <dl className="mt-4 divide-y divide-border border-y border-border">
              <StatItem value={formatNumberId(stats.total)} label="CVE terbaru" />
              <StatItem value={formatNumberId(stats.critical)} label="tingkat kritis" tone="critical" />
              <StatItem value={formatNumberId(stats.vendors)} label="vendor" />
            </dl>
            <Link href="/sources" className="mt-5 inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-accent hover:underline">
              <Database className="size-3.5" />
              Sumber dan metodologi
              <ArrowRight className="size-3.5" />
            </Link>
          </aside>
        </div>
      </section>

      {/* LATEST CVEs */}
      <SectionShell
        title="CVE Terbaru"
        description="Kerentanan yang paling baru ditambahkan ke basis data ini."
        href="/search"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((cve, index) => (
            <CVECard key={cve.id} cve={cve} featured={index === 0} />
          ))}
        </div>
      </SectionShell>

      {/* CRITICAL CVEs */}
      <div className="navy-panel border-y border-border">
        <SectionShell
          title="CVE Tingkat Kritis"
          description="Kerentanan dengan dampak paling parah — perlu perhatian dan penambalan segera."
          href="/search?severity=CRITICAL"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {critical.map((cve) => (
              <CVECard key={cve.id} cve={cve} />
            ))}
          </div>
        </SectionShell>
      </div>

      {/* HIGH SEVERITY CVEs */}
      <div className="border-b border-border">
        <SectionShell
          title="CVE Tingkat Tinggi"
          description="Signifikan dan patut diwaspadai, meski tidak seekstrem tingkat kritis."
          href="/search?severity=HIGH"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {high.map((cve) => (
              <CVECard key={cve.id} cve={cve} />
            ))}
          </div>
        </SectionShell>
      </div>

      {/* VENDORS & PRODUCTS */}
      <SectionShell title="Vendor & Produk" description="Jelajahi kerentanan berdasarkan vendor atau produk tertentu.">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-16">
          <FacetList title="Vendor terbaru" items={vendors} parameter="vendor" />
          <FacetList title="Produk terbaru" items={products} parameter="product" />
        </div>
      </SectionShell>

      {/* SECURITY CATEGORIES */}
      <SectionShell title="Kategori Keamanan" description="Pilih area sistem untuk mempersempit pencarian.">
        <div className="grid grid-cols-1 border-t border-border sm:grid-cols-2 sm:gap-x-10">
          {categories.map((cat) => (
            <CategoryCard key={cat.slug} slug={cat.slug} name={cat.name} descriptionId={cat.descriptionId} count={cat.count} />
          ))}
        </div>
      </SectionShell>

      {/* LEARNING SECTION */}
      <section className="border-t border-border/70 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
            <div className="max-w-md">
              <p className="eyebrow text-[10px]">Belajar keamanan siber</p>
              <h2 className="content-heading mt-4 font-display text-2xl font-medium leading-snug text-foreground">
                Bingung dengan istilah seperti RCE atau IDOR?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Glosarium kami menjelaskan istilah-istilah keamanan siber yang paling sering muncul, dengan bahasa
                Indonesia yang sederhana — cocok untuk pemula sekalipun.
              </p>
              <Button asChild variant="link" className="mt-5">
                <Link href="/glossary">
                  Buka Glosarium
                  <ArrowRight />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-0 border-y border-border sm:grid-cols-2 sm:gap-x-8">
              {featuredTerms.map((term) => (
                <div key={term.slug} className="border-b border-border py-4 last:border-b-0">
                  <p className="data-tag text-sm font-medium text-accent">{term.term}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {truncate(term.definitionId, 90)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionShell({
  title,
  description,
  href,
  children,
}: {
  title: string;
  description: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-border pb-4">
          <div>
          <h2 className="content-heading font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          {href && (
            <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline shrink-0 self-start sm:self-auto">
              Lihat semua
              <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

function StatItem({ value, label, tone = "default" }: { value: string; label: string; tone?: "default" | "critical" }) {
  return (
    <div className="flex flex-col sm:flex-row lg:flex-row items-start sm:items-baseline lg:items-baseline justify-between gap-1 sm:gap-4 py-3 sm:py-4">
      <dt className="text-xs sm:text-sm text-muted-foreground">{label}</dt>
      <dd className={tone === "critical" ? "data-tag text-lg sm:text-xl font-semibold text-severity-critical-fg" : "data-tag text-lg sm:text-xl font-semibold text-foreground"}>
        {value}
      </dd>
    </div>
  );
}

function FacetList({ title, items, parameter }: { title: string; items: { value: string; count: number }[]; parameter: "vendor" | "product" }) {
  return (
    <div>
      <h3 className="font-display text-base font-medium text-foreground">{title}</h3>
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {items.map((item) => (
          <li key={item.value}>
            <Link
              href={`/search?${parameter}=${encodeURIComponent(item.value)}`}
              className="group flex items-center justify-between gap-4 py-3 text-sm transition-colors hover:text-accent"
            >
              <span className="truncate text-foreground group-hover:text-accent">{item.value}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground group-hover:text-accent">
                {item.count} CVE <ArrowUpRight className="size-3" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
