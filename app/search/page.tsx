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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: "Cari CVE" }]} />

      <h1 className="font-display text-2xl font-medium text-foreground sm:text-3xl">Cari CVE</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {result.total > 0
          ? `Menampilkan ${result.results.length} dari ${result.total} hasil.`
          : "Masukkan kata kunci atau gunakan filter di samping."}
      </p>

      <div className="mt-6">
        <SearchBar defaultValue={params.query} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
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

        <div>
          {result.results.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {result.results.map((cve) => (
                  <CVECard key={cve.id} cve={cve} />
                ))}
              </div>
              <div className="mt-10">
                <Pagination currentPage={result.page} totalPages={result.totalPages} searchParams={raw} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
