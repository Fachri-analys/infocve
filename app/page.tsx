import Link from "next/link";
import { ArrowRight, BookOpen, ShieldAlert } from "lucide-react";

import { SearchBar } from "@/components/search/search-bar";
import { CVECard } from "@/components/cve/cve-card";
import { CVETicker } from "@/components/cve/cve-ticker";
import { CategoryCard } from "@/components/cve/category-card";
import { Card } from "@/components/ui/card";
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
import { formatNumberId, truncate } from "@/utils/format";
import { SITE_DESCRIPTION } from "@/utils/constants";

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

  return (
    <div>
      <CVETicker cves={latest} />

      {/* HERO */}
      <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="data-tag inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground">
            <ShieldAlert className="size-3.5 text-accent" />
            Dibuat untuk pengguna Indonesia
          </span>
          <h1 className="mt-5 font-display text-4xl font-medium leading-[1.1] tracking-tight text-foreground sm:text-5xl">
            Pahami kerentanan siber,{" "}
            <span className="text-accent">tanpa harus jadi ahli</span> dulu.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">{SITE_DESCRIPTION}</p>

          <div className="mx-auto mt-8 max-w-xl">
            <SearchBar size="lg" />
          </div>

          <div className="mx-auto mt-8 flex max-w-md items-center justify-around gap-4 text-center">
            <div>
              <p className="font-display text-xl font-medium text-foreground">{formatNumberId(stats.total)}</p>
              <p className="text-xs text-muted-foreground">CVE Tersedia</p>
            </div>
            <div>
              <p className="font-display text-xl font-medium text-severity-critical-fg">{formatNumberId(stats.critical)}</p>
              <p className="text-xs text-muted-foreground">Tingkat Kritis</p>
            </div>
            <div>
              <p className="font-display text-xl font-medium text-foreground">{formatNumberId(stats.vendors)}</p>
              <p className="text-xs text-muted-foreground">Vendor</p>
            </div>
          </div>
        </div>
      </section>

      {/* LATEST CVEs */}
      <SectionShell
        title="CVE Terbaru"
        description="Kerentanan yang paling baru ditambahkan ke basis data ini."
        href="/search"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((cve) => (
            <CVECard key={cve.id} cve={cve} />
          ))}
        </div>
      </SectionShell>

      {/* CRITICAL CVEs — tinted band */}
      <div className="border-y border-severity-critical/15 bg-severity-critical/[0.04]">
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

      {/* HIGH SEVERITY CVEs — tinted band */}
      <div className="border-b border-severity-high/15 bg-severity-high/[0.04]">
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <h3 className="mb-4 font-display text-sm font-medium text-foreground">Vendor Terbaru</h3>
            <div className="flex flex-wrap gap-2">
              {vendors.map((v) => (
                <Link
                  key={v.value}
                  href={`/search?vendor=${encodeURIComponent(v.value)}`}
                  className="rounded-full border border-border bg-surface-hover/50 px-3 py-1.5 text-xs text-foreground transition-colors hover:border-accent/40 hover:text-accent"
                >
                  {v.value} <span className="text-muted-foreground">({v.count})</span>
                </Link>
              ))}
            </div>
          </Card>
          <Card className="p-5 sm:p-6">
            <h3 className="mb-4 font-display text-sm font-medium text-foreground">Produk Terbaru</h3>
            <div className="flex flex-wrap gap-2">
              {products.map((p) => (
                <Link
                  key={p.value}
                  href={`/search?product=${encodeURIComponent(p.value)}`}
                  className="rounded-full border border-border bg-surface-hover/50 px-3 py-1.5 text-xs text-foreground transition-colors hover:border-accent/40 hover:text-accent"
                >
                  {p.value} <span className="text-muted-foreground">({p.count})</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </SectionShell>

      {/* SECURITY CATEGORIES */}
      <SectionShell title="Kategori Keamanan" description="Kelompok kerentanan berdasarkan area sistem yang terdampak.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((cat) => (
            <CategoryCard key={cat.slug} slug={cat.slug} name={cat.name} descriptionId={cat.descriptionId} count={cat.count} />
          ))}
        </div>
      </SectionShell>

      {/* LEARNING SECTION */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Card className="grid grid-cols-1 gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-accent/12 px-3 py-1 text-xs font-medium text-accent">
                <BookOpen className="size-3.5" />
                Belajar Keamanan Siber
              </span>
              <h2 className="mt-4 font-display text-2xl font-medium leading-snug text-foreground">
                Bingung dengan istilah seperti RCE atau IDOR?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Glosarium kami menjelaskan istilah-istilah keamanan siber yang paling sering muncul, dengan bahasa
                Indonesia yang sederhana — cocok untuk pemula sekalipun.
              </p>
              <Button asChild className="mt-6">
                <Link href="/glossary">
                  Buka Glosarium
                  <ArrowRight />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {featuredTerms.map((term) => (
                <div key={term.slug} className="rounded-xl border border-border bg-surface-hover/40 p-4">
                  <p className="data-tag text-sm font-medium text-accent">{term.term}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {truncate(term.definitionId, 90)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
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
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-medium text-foreground sm:text-2xl">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          {href && (
            <Link href={href} className="flex items-center gap-1 text-sm font-medium text-accent hover:underline">
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
