import "server-only";

import type { CVE, CVECategory, PaginatedResult, SearchCVEParams } from "@/types/cve";
import type { SecurityCategory } from "@/types";
import type { NvdCveRecord, NvdQueryParams } from "@/lib/nvd-types";
import { fetchNvd, NvdApiError } from "@/lib/nvd-client";
import { normalizeNvdCve } from "@/lib/nvd-normalize";
import { CATEGORY_META, DEFAULT_PAGE_SIZE } from "@/utils/constants";

/**
 * Public data-service layer for CVE records — a thin orchestration layer
 * over `lib/nvd-client.ts` (HTTP transport) and `lib/nvd-normalize.ts`
 * (raw NVD -> internal `CVE` mapping). This is the ONLY file the rest of the
 * app imports from; nothing above this layer (pages, components) ever sees
 * a raw NVD response or touches `fetch` directly.
 *
 * -- Why split across three files instead of one -------------------------
 * HTTP transport, response-shape mapping, and public orchestration are
 * different concerns that change for different reasons (NVD tweaking rate
 * limits vs. NVD adding a field vs. this app adding a new convenience
 * function). Keeping them separate is what makes each piece testable and
 * change-safe on its own -- this file's exports and signatures are exactly
 * what they were before, so no page or component needed to change.
 *
 * -- Why some functions never throw ---------------------------------------
 * `getCVEById` distinguishes "confirmed not found" (-> `null`, existing
 * `notFound()` call sites keep working unchanged) from "couldn't reach NVD"
 * (-> throws `NvdApiError`, caught by `app/error.tsx`). Every *list*-shaped
 * function (search, latest, critical, facets, stats, ...) instead swallows
 * failures and returns an empty/zeroed result: a partial or unreachable NVD
 * response should degrade a list to "nothing to show" (which the existing
 * `EmptyState` UI already handles) rather than take down a whole page --
 * including at build time, since several of these run during static
 * generation and an uncaught throw there fails the build, not just the
 * request. The real error is still logged server-side either way.
 *
 * -- Query planning against a real, rate-limited, non-aggregating API ----
 * NVD's `cvssV3Severity` and `cweId` params only accept ONE value each,
 * `pubStartDate/pubEndDate` and `lastModStartDate/lastModEndDate` cannot
 * both be used in the same request, any date range is capped at 120 days,
 * and there is no "vendor"/"product"/"year" parameter or facet/aggregation
 * endpoint at all. `searchCVEs` below sends whatever filters map cleanly
 * onto real NVD parameters (shrinking what has to be fetched), then re-runs
 * the *complete* filter pipeline client-side on the normalized results
 * regardless -- re-applying a filter NVD already satisfied is harmless, and
 * it means correctness never depends on the native/client split being
 * exactly right. `getVendors`/`getProducts`/`getCategories`/`getAvailableYears`/
 * `getAvailableCWEs`/`getStats` derive from one shared, longer-cached
 * "recent sample" fetch (NVD has no facet endpoint to ask directly) -- see
 * `docs/API_INTEGRATION.md` for the full reasoning and its limitations.
 */

const REVALIDATE = {
  detail: 21_600, // 6h -- an individual CVE record changes rarely once published
  search: 3_600, // 1h -- reasonably fresh without hammering the API
  facetSample: 21_600, // 6h -- the shared "recent batch" facets are derived from
} as const;

const CLIENT_REFINE_BATCH_SIZE = 200;
const FACET_SAMPLE_SIZE = 2000; // NVD's own max resultsPerPage
const MAX_DATE_RANGE_DAYS = 120; // NVD's documented hard limit on any date-range param

function logAndFallback(context: string, error: unknown): void {
  const message = error instanceof NvdApiError ? `[${error.kind}] ${error.message}` : String(error);
  console.error(`[lib/nvd] ${context} failed, degrading to empty result: ${message}`);
}

function emptyPage(pageSize: number): PaginatedResult<CVE> {
  return { results: [], total: 0, page: 1, pageSize, totalPages: 1 };
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.abs(new Date(toIso).getTime() - new Date(fromIso).getTime()) / (1000 * 60 * 60 * 24);
}

function toIsoRangeBounds(fromDate: string, toDate: string): { start: string; end: string } {
  return { start: `${fromDate}T00:00:00.000`, end: `${toDate}T23:59:59.999` };
}

// ---------------------------------------------------------------------------
// Client-side filter/sort/paginate pipeline (re-run on every fetched batch --
// see the "query planning" note above for why this is always safe to do).
// ---------------------------------------------------------------------------

function matchesQuery(cve: CVE, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    cve.id.toLowerCase().includes(q) ||
    cve.title.toLowerCase().includes(q) ||
    cve.vendor.toLowerCase().includes(q) ||
    cve.product.toLowerCase().includes(q) ||
    cve.descriptionEn.toLowerCase().includes(q) ||
    cve.cwe.some((c) => c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
  );
}

function inDateRange(dateIso: string, from?: string, to?: string): boolean {
  const time = new Date(dateIso).getTime();
  if (from && time < new Date(from).getTime()) return false;
  if (to && time > new Date(`${to}T23:59:59.999`).getTime()) return false;
  return true;
}

function applyFilters(cves: CVE[], params: SearchCVEParams): CVE[] {
  let filtered = cves.filter((c) => matchesQuery(c, params.query ?? ""));

  const { severity, year, vendor, product, cwe } = params;
  if (severity?.length) filtered = filtered.filter((c) => severity.includes(c.cvss.severity));
  if (year?.length) filtered = filtered.filter((c) => year.includes(c.year));
  if (vendor?.length) filtered = filtered.filter((c) => vendor.includes(c.vendor));
  if (product?.length) filtered = filtered.filter((c) => product.includes(c.product));
  if (cwe?.length) filtered = filtered.filter((c) => c.cwe.some((w) => cwe.includes(w.id)));

  if (params.category) filtered = filtered.filter((c) => c.category === params.category);
  if (params.publishedFrom || params.publishedTo) {
    filtered = filtered.filter((c) => inDateRange(c.publishedDate, params.publishedFrom, params.publishedTo));
  }
  if (params.modifiedFrom || params.modifiedTo) {
    filtered = filtered.filter((c) => inDateRange(c.lastModifiedDate, params.modifiedFrom, params.modifiedTo));
  }
  return filtered;
}

function sortCVEs(cves: CVE[], sortBy: SearchCVEParams["sortBy"], sortOrder: SearchCVEParams["sortOrder"]): CVE[] {
  const order = sortOrder === "asc" ? 1 : -1;
  return [...cves].sort((a, b) => {
    switch (sortBy) {
      case "baseScore":
        return (a.cvss.baseScore - b.cvss.baseScore) * order;
      case "lastModifiedDate":
        return (new Date(a.lastModifiedDate).getTime() - new Date(b.lastModifiedDate).getTime()) * order;
      case "publishedDate":
      default:
        return (new Date(a.publishedDate).getTime() - new Date(b.publishedDate).getTime()) * order;
    }
  });
}

function paginate(cves: CVE[], page: number, pageSize: number): PaginatedResult<CVE> {
  const total = cves.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return { results: cves.slice(start, start + pageSize), total, page: safePage, pageSize, totalPages };
}

// ---------------------------------------------------------------------------
// Query planning -- decide what can be asked of NVD natively
// ---------------------------------------------------------------------------

function buildNativeParams(params: SearchCVEParams): NvdQueryParams {
  const native: NvdQueryParams = {};

  const keyword = params.query?.trim() || params.vendor?.[0] || params.product?.[0];
  if (keyword) native.keywordSearch = keyword;

  if (params.severity?.length === 1 && params.severity[0] !== "NONE") {
    native.cvssV3Severity = params.severity[0] as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  }

  if (params.cwe?.length === 1) native.cweId = params.cwe[0];

  // pubDate and lastModDate ranges can't both be sent in one request, and
  // NVD requires both bounds together with a span no longer than 120 days.
  // Published range wins when both are present and eligible.
  if (params.publishedFrom && params.publishedTo) {
    const { start, end } = toIsoRangeBounds(params.publishedFrom, params.publishedTo);
    if (daysBetween(start, end) <= MAX_DATE_RANGE_DAYS) {
      native.pubStartDate = start;
      native.pubEndDate = end;
    }
  } else if (params.modifiedFrom && params.modifiedTo) {
    const { start, end } = toIsoRangeBounds(params.modifiedFrom, params.modifiedTo);
    if (daysBetween(start, end) <= MAX_DATE_RANGE_DAYS) {
      native.lastModStartDate = start;
      native.lastModEndDate = end;
    }
  }

  return native;
}

/** True when every requested filter maps exactly onto what was sent natively -- safe to trust NVD's own pagination/total. */
function isFullyNative(params: SearchCVEParams, native: NvdQueryParams): boolean {
  const severityHandledNatively = !params.severity?.length || (params.severity.length === 1 && !!native.cvssV3Severity);
  const cweHandledNatively = !params.cwe?.length || (params.cwe.length === 1 && !!native.cweId);
  const noYearOrCategory = !params.year?.length && !params.category;
  // Vendor/product have no real native NVD parameter — buildNativeParams only
  // ever approximates them via a keywordSearch fallback, and only when there's
  // no `query` to take priority over it (see buildNativeParams above). Treating
  // that approximation as "fully native" would trust NVD's own pagination/total
  // and skip applyFilters below entirely, silently dropping the exact vendor/
  // product match. So any vendor or product filter always forces the
  // fetch-then-filter path instead.
  const noVendorOrProduct = !params.vendor?.length && !params.product?.length;
  const dateRangeHandled =
    (!params.publishedFrom && !params.publishedTo && !params.modifiedFrom && !params.modifiedTo) ||
    (!!native.pubStartDate && !params.modifiedFrom) ||
    (!!native.lastModStartDate && !params.publishedFrom);

  return severityHandledNatively && cweHandledNatively && noYearOrCategory && noVendorOrProduct && dateRangeHandled;
}

async function fetchNormalized(params: NvdQueryParams, revalidateSeconds: number, tags?: string[]) {
  const response = await fetchNvd(params, { revalidateSeconds, tags });
  return {
    cves: response.vulnerabilities.map((wrapper) => normalizeNvdCve(wrapper.cve)),
    totalResults: response.totalResults,
  };
}

// ---------------------------------------------------------------------------
// Required public API
// ---------------------------------------------------------------------------

/** Most recently *published* CVEs. Powers the homepage's "CVE Terbaru" section and the ticker. */
export async function getLatestCVEs(limit = 6): Promise<CVE[]> {
  try {
    const { cves } = await fetchNormalized({ resultsPerPage: limit }, REVALIDATE.search, ["nvd:latest"]);
    return sortCVEs(cves, "publishedDate", "desc").slice(0, limit);
  } catch (error) {
    logAndFallback("getLatestCVEs", error);
    return [];
  }
}

/** Shorthand for `searchCVEs({ severity: ["CRITICAL"] })`, newest first. */
export async function getCriticalCVEs(limit = 4): Promise<CVE[]> {
  const result = await searchCVEs({ severity: ["CRITICAL"], sortBy: "publishedDate", sortOrder: "desc", pageSize: limit });
  return result.results;
}

/** Shorthand for `searchCVEs({ severity: ["HIGH"] })`, newest first. */
export async function getHighCVEs(limit = 4): Promise<CVE[]> {
  const result = await searchCVEs({ severity: ["HIGH"], sortBy: "publishedDate", sortOrder: "desc", pageSize: limit });
  return result.results;
}

/**
 * Most recently *modified* CVEs -- distinct from `getLatestCVEs` (published).
 * Useful for surfacing records NVD has just re-analyzed, rescored, or
 * corrected, which is one of the NVD API's own canonical use cases for the
 * `lastModStartDate`/`lastModEndDate` parameters.
 */
export async function getRecentCVEs(limit = 6): Promise<CVE[]> {
  try {
    const end = new Date();
    const start = new Date(end.getTime() - MAX_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000);
    const { cves } = await fetchNormalized(
      {
        lastModStartDate: start.toISOString(),
        lastModEndDate: end.toISOString(),
        resultsPerPage: Math.max(limit, 50),
      },
      REVALIDATE.search,
      ["nvd:recent"]
    );
    return sortCVEs(cves, "lastModifiedDate", "desc").slice(0, limit);
  } catch (error) {
    logAndFallback("getRecentCVEs", error);
    return [];
  }
}

/**
 * A single CVE by its exact ID.
 * - Returns `null` only when NVD confirms the ID doesn't exist (0 results) --
 *   callers keep using this for `notFound()` exactly as before.
 * - Throws `NvdApiError` for anything else (network/timeout/server/rate
 *   limit), letting `app/error.tsx` show a distinguishable "try again"
 *   message instead of a false 404. Safe to throw here specifically because
 *   this route has no `generateStaticParams` -- it only ever renders
 *   on-demand, never during `next build`.
 */
export async function getCVEById(id: string): Promise<CVE | null> {
  const normalizedId = id.trim().toUpperCase();
  if (!/^CVE-\d{4}-\d{4,}$/.test(normalizedId)) return null;

  const response = await fetchNvd({ cveId: normalizedId }, { revalidateSeconds: REVALIDATE.detail, tags: [`nvd:cve:${normalizedId}`] });
  const record: NvdCveRecord | undefined = response.vulnerabilities[0]?.cve;
  return record ? normalizeNvdCve(record) : null;
}

/** The full filter + sort + paginate pipeline backing the search page. */
export async function searchCVEs(params: SearchCVEParams = {}): Promise<PaginatedResult<CVE>> {
  const pageSize = Math.max(1, Math.floor(params.pageSize ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE);
  const page = Math.max(1, Math.floor(params.page ?? 1) || 1);

  try {
    const native = buildNativeParams(params);
    const fullyNative = isFullyNative(params, native);

    if (fullyNative) {
      const { cves, totalResults } = await fetchNormalized(
        { ...native, resultsPerPage: pageSize, startIndex: (page - 1) * pageSize },
        REVALIDATE.search,
        ["nvd:search"]
      );
      const sorted = sortCVEs(cves, params.sortBy ?? "publishedDate", params.sortOrder ?? "desc");
      const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
      return { results: sorted, total: totalResults, page: Math.min(Math.max(1, page), totalPages), pageSize, totalPages };
    }

    const { cves } = await fetchNormalized(
      { ...native, resultsPerPage: CLIENT_REFINE_BATCH_SIZE, startIndex: 0 },
      REVALIDATE.search,
      ["nvd:search"]
    );
    const filtered = applyFilters(cves, params);
    const sorted = sortCVEs(filtered, params.sortBy ?? "publishedDate", params.sortOrder ?? "desc");
    return paginate(sorted, page, pageSize);
  } catch (error) {
    logAndFallback("searchCVEs", error);
    return emptyPage(pageSize);
  }
}

/** All CVEs attributed to a given vendor, newest first. */
export async function getCVEsByVendor(vendorName: string, limit?: number): Promise<CVE[]> {
  const result = await searchCVEs({ vendor: [vendorName], pageSize: limit ?? CLIENT_REFINE_BATCH_SIZE });
  return result.results;
}

/** All CVEs for a given product, newest first. */
export async function getCVEsByProduct(productName: string, limit?: number): Promise<CVE[]> {
  const result = await searchCVEs({ product: [productName], pageSize: limit ?? CLIENT_REFINE_BATCH_SIZE });
  return result.results;
}

/**
 * All CVEs published in a given year, newest first.
 *
 * A single year always exceeds NVD's 120-day range cap, so this issues up
 * to four ~91-day windows in parallel and merges them -- more requests than
 * the generic `searchCVEs({ year: [...] })` path (which treats `year` as a
 * client-side-only signal over one smaller batch, see `buildNativeParams`),
 * but accurate for the whole year rather than an approximation. Worth the
 * extra calls since this is a deliberate, named lookup rather than
 * something combined with several other filters at once.
 */
export async function getCVEsByYear(year: number, limit = 50): Promise<CVE[]> {
  try {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    const windowMs = MAX_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000 * 0.75; // ~91 days, safely under the cap

    const windows: { start: Date; end: Date }[] = [];
    for (let cursor = yearStart.getTime(); cursor <= yearEnd.getTime(); cursor += windowMs) {
      const windowEnd = Math.min(cursor + windowMs, yearEnd.getTime());
      windows.push({ start: new Date(cursor), end: new Date(windowEnd) });
    }

    const batches = await Promise.all(
      windows.map(({ start, end }) =>
        fetchNormalized(
          { pubStartDate: start.toISOString(), pubEndDate: end.toISOString(), resultsPerPage: 500 },
          REVALIDATE.search,
          [`nvd:year:${year}`]
        ).catch((error) => {
          logAndFallback(`getCVEsByYear(${year}) window ${start.toISOString()}`, error);
          return { cves: [] as CVE[], totalResults: 0 };
        })
      )
    );

    const merged = new Map<string, CVE>();
    for (const batch of batches) for (const cve of batch.cves) merged.set(cve.id, cve);

    return sortCVEs([...merged.values()], "publishedDate", "desc").slice(0, limit);
  } catch (error) {
    logAndFallback(`getCVEsByYear(${year})`, error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Facets & stats -- NVD has no aggregation endpoint, so these all derive
// from one shared, longer-cached "recent sample" fetch (deduplicated
// automatically by Next.js's fetch cache, since every call below uses the
// same URL/params/revalidate window). See docs/API_INTEGRATION.md for the
// accuracy tradeoff this implies versus a true global count.
// ---------------------------------------------------------------------------

async function getFacetSample(): Promise<CVE[]> {
  const end = new Date();
  const start = new Date(end.getTime() - MAX_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000);
  const { cves } = await fetchNormalized(
    { pubStartDate: start.toISOString(), pubEndDate: end.toISOString(), resultsPerPage: FACET_SAMPLE_SIZE },
    REVALIDATE.facetSample,
    ["nvd:facet-sample"]
  );
  return cves;
}

export interface FacetCount {
  value: string;
  count: number;
}

function countBy<T>(items: T[], keyOf: (item: T) => string): FacetCount[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(keyOf(item), (counts.get(keyOf(item)) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
}

/** Vendors present in the recent sample, most-represented first. */
export async function getVendors(limit?: number): Promise<FacetCount[]> {
  try {
    const sorted = countBy(await getFacetSample(), (c) => c.vendor);
    return limit ? sorted.slice(0, limit) : sorted;
  } catch (error) {
    logAndFallback("getVendors", error);
    return [];
  }
}

/** Products present in the recent sample, most-represented first. */
export async function getProducts(limit?: number): Promise<FacetCount[]> {
  try {
    const sorted = countBy(await getFacetSample(), (c) => c.product);
    return limit ? sorted.slice(0, limit) : sorted;
  } catch (error) {
    logAndFallback("getProducts", error);
    return [];
  }
}

/** Years present in the recent sample, most recent first. */
export async function getAvailableYears(): Promise<number[]> {
  try {
    const sample = await getFacetSample();
    return [...new Set(sample.map((c) => c.year))].sort((a, b) => b - a);
  } catch (error) {
    logAndFallback("getAvailableYears", error);
    return [];
  }
}

/** CWEs present in the recent sample. */
export async function getAvailableCWEs(): Promise<{ id: string; name: string }[]> {
  try {
    const sample = await getFacetSample();
    const map = new Map<string, string>();
    for (const cve of sample) for (const w of cve.cwe) map.set(w.id, w.name);
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    logAndFallback("getAvailableCWEs", error);
    return [];
  }
}

/** Categories present in the recent sample, with counts -- powers the homepage. Only non-empty categories are returned. */
export async function getCategories(): Promise<(SecurityCategory & { count: number })[]> {
  try {
    const sample = await getFacetSample();
    const counts = new Map<CVECategory, number>();
    for (const cve of sample) counts.set(cve.category, (counts.get(cve.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([slug, count]) => ({ slug, count, ...CATEGORY_META[slug] }));
  } catch (error) {
    logAndFallback("getCategories", error);
    return [];
  }
}

/** Aggregate counts used in the hero's small stats row -- derived from the same recent sample, so "total" means "in the last 120 days", not "all of NVD history". */
export async function getStats(): Promise<{ total: number; critical: number; high: number; vendors: number }> {
  try {
    const sample = await getFacetSample();
    return {
      total: sample.length,
      critical: sample.filter((c) => c.cvss.severity === "CRITICAL").length,
      high: sample.filter((c) => c.cvss.severity === "HIGH").length,
      vendors: new Set(sample.map((c) => c.vendor)).size,
    };
  } catch (error) {
    logAndFallback("getStats", error);
    return { total: 0, critical: 0, high: 0, vendors: 0 };
  }
}
