import type { Metadata } from "next";

import { Breadcrumb } from "@/components/common/breadcrumb";
import { EmptyState } from "@/components/common/empty-state";
import { CVECard } from "@/components/cve/cve-card";
import { SearchBar } from "@/components/search/search-bar";
import { SearchFilters } from "@/components/search/search-filters";
import { Pagination } from "@/components/search/pagination";
import { getAvailableCWEs, getAvailableYears, getProducts, getVendors, searchCVEs } from "@/lib/nvd";
import { isValidSeverity } from "@/utils/severity";
import { DEFAULT_PAGE_SIZE, isValidCategory } from "@/utils/constants";
import { buildPageMetadata } from "@/utils/metadata";
import type { SearchCVEParams } from "@/types/cve";

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Strictly validates YYYY-MM-DD calendar dates. Rejects invalid dates like 2026-02-31. */
export function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (month < 1 || month > 12) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseDateParam(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return isValidCalendarDate(value) ? value : undefined;
}

const ALLOWED_SORT_BY = ["publishedDate", "lastModifiedDate", "baseScore"] as const;
const ALLOWED_SORT_ORDER = ["asc", "desc"] as const;

function parseSortParam(sortParam?: string): { sortBy: SearchCVEParams["sortBy"]; sortOrder: SearchCVEParams["sortOrder"] } {
  if (!sortParam) return { sortBy: "publishedDate", sortOrder: "desc" };
  const [rawBy, rawOrder] = sortParam.split("-");
  const sortBy = (ALLOWED_SORT_BY as readonly string[]).includes(rawBy ?? "")
    ? (rawBy as SearchCVEParams["sortBy"])
    : "publishedDate";
  const sortOrder = (ALLOWED_SORT_ORDER as readonly string[]).includes(rawOrder ?? "")
    ? (rawOrder as SearchCVEParams["sortOrder"])
    : "desc";
  return { sortBy, sortOrder };
}

function parseParams(raw: Record<string, string | string[] | undefined>): SearchCVEParams {
  const query = first(raw.q) ?? "";
  const severityRaw = Array.isArray(raw.severity) ? raw.severity : raw.severity ? [raw.severity] : [];
  const severity = severityRaw.filter(isValidSeverity);
  const yearParam = first(raw.year);
  const parsedYear = yearParam ? Number(yearParam) : NaN;
  const year = !Number.isNaN(parsedYear) && parsedYear >= 1999 && parsedYear <= new Date().getFullYear() + 1 ? [parsedYear] : undefined;
  const vendor = first(raw.vendor);
  const product = first(raw.product);
  const cwe = first(raw.cwe);
  const categoryRaw = first(raw.category);
  const category = categoryRaw && isValidCategory(categoryRaw) ? categoryRaw : undefined;
  const { sortBy, sortOrder } = parseSortParam(first(raw.sort));
  const rawPage = Number(first(raw.page));
  const page = !Number.isNaN(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  return {
    query,
    severity: severity.length ? severity : undefined,
    year,
    vendor: vendor ? [vendor] : undefined,
    product: product ? [product] : undefined,
    cwe: cwe ? [cwe] : undefined,
    category,
    publishedFrom: parseDateParam(first(raw.publishedFrom)),
    publishedTo: parseDateParam(first(raw.publishedTo)),
    modifiedFrom: parseDateParam(first(raw.modifiedFrom)),
    modifiedTo: parseDateParam(first(raw.modifiedTo)),
    sortBy,
    sortOrder,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const raw = await searchParams;
  const query = first(raw.q);
  return buildPageMetadata({
    title: query ? `Hasil pencarian: "${query}"` : "Cari CVE",
    description:
      "Cari kerentanan berdasarkan CVE ID, vendor, produk, atau kata kunci, dengan filter tingkat keparahan, tahun, rentang tanggal, dan CWE.",
    path: "/search",
  });
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const raw = await searchParams;
  const params = parseParams(raw);

  const [result, years, vendors, products, cwes] = await Promise.all([
    searchCVEs(params),
    getAvailableYears(),
    getVendors(),
    getProducts(),
    getAvailableCWEs(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 animate-fade-in">
      <Breadcrumb items={[{ label: "Cari CVE" }]} />

      <section aria-labelledby="search-page-title" className="editorial-panel navy-panel -mx-4 mb-12 border-y border-border sm:mx-0 sm:border">
        <div className="relative grid gap-8 px-4 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-12 lg:px-10 lg:py-12">
          <div className="max-w-3xl">
            <p className="eyebrow mb-5 text-[10px] text-accent">01 / Direktori kerentanan</p>
            <h1 id="search-page-title" className="content-heading font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Temukan celah.<br />
              <span className="text-accent">Pahami dampaknya.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Telusuri CVE berdasarkan ID, vendor, produk, atau kata kunci. Persempit hasil dengan tingkat keparahan, tanggal, dan CWE.
            </p>
            <SearchBar defaultValue={params.query} size="lg" appearance="hero" className="mt-7 max-w-3xl" />
            <p className="mt-3 text-xs text-muted-foreground">
              Coba <span className="data-tag text-foreground">CVE-2021-44228</span>, nama vendor, atau istilah seperti <span className="text-foreground">remote code execution</span>.
            </p>
          </div>

          <aside aria-label="Ringkasan hasil pencarian" className="grid grid-cols-2 gap-5 border-t border-border pt-5 sm:gap-8 lg:grid-cols-1 lg:content-end lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <div>
              <p className="data-tag text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Cocok dengan pencarian</p>
              <p className="data-tag mt-2 text-4xl font-medium leading-none text-accent sm:text-5xl">{result.total.toLocaleString("id-ID")}</p>
              <p className="mt-2 text-xs text-muted-foreground">kerentanan ditemukan</p>
            </div>
            <div className="border-l border-border pl-5 lg:border-l-0 lg:border-t lg:pl-0 lg:pt-5">
              <p className="data-tag text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Halaman hasil</p>
              <p className="data-tag mt-2 text-2xl font-medium text-foreground">
                {result.total > 0 ? `${String(result.page).padStart(2, "0")} / ${String(result.totalPages).padStart(2, "0")}` : "—"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{result.results.length} entri di halaman ini</p>
            </div>
          </aside>
        </div>
      </section>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10">
        <aside>
          <SearchFilters
            query={params.query ?? ""}
            years={years}
            vendors={vendors}
            products={products}
            cwes={cwes}
            selected={{
              severity: params.severity ?? [],
              year: params.year?.[0],
              vendor: params.vendor?.[0],
              product: params.product?.[0],
              cwe: params.cwe?.[0],
              category: params.category,
              publishedFrom: params.publishedFrom,
              publishedTo: params.publishedTo,
              modifiedFrom: params.modifiedFrom,
              modifiedTo: params.modifiedTo,
              sortBy: params.sortBy ?? "publishedDate",
              sortOrder: params.sortOrder ?? "desc",
            }}
          />
        </aside>

        <section aria-label="Hasil pencarian">
          <div className="mb-5 flex items-end justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="eyebrow mb-2 text-[10px]">Daftar hasil</p>
              <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">
                {params.query ? `“${params.query}”` : "Semua kerentanan"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {params.query ? "Hasil yang sesuai dengan kata kunci Anda." : "Gunakan filter untuk mempersempit direktori."}
              </p>
            </div>
            <span className="data-tag hidden text-xs text-muted-foreground sm:block">
              {result.results.length.toString().padStart(2, "0")} / {DEFAULT_PAGE_SIZE.toString().padStart(2, "0")}
            </span>
          </div>
          {result.results.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {result.results.map((cve, index) => (
                  <CVECard key={cve.id} cve={cve} featured={index === 0} />
                ))}
              </div>
              <div className="mt-10">
                <Pagination currentPage={result.page} totalPages={result.totalPages} searchParams={raw} />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
