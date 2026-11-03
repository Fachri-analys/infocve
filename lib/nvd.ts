import "server-only";

import type { CVE, PaginatedResult, SearchCVEParams } from "@/types/cve";
import type { SecurityCategory } from "@/types";
import { fetchNvd, NvdApiError } from "@/lib/nvd-client";
import type { NvdCveRecord } from "@/lib/nvd-types";
import { normalizeNvdCve } from "@/lib/nvd-normalize";
import { fillMissingCveEntities } from "@/lib/cve/cna-fallback";
import { CveRepository } from "@/lib/db/cve-repository";
import {
  getNeonCveById,
  getNeonCveClient,
  getNeonCategoryCounts,
  getNeonFacetCounts,
  getNeonLatestCves,
  getNeonStats,
  isNeonCveConfigured,
  searchNeonCves,
} from "@/lib/db/neon-cve-repository";
import { getCweName } from "@/lib/cwe-catalog";
import { CATEGORY_META, DEFAULT_PAGE_SIZE } from "@/utils/constants";
import { unavailableSearchResult } from "@/lib/search/result-state";

export interface FacetCount {
  value: string;
  count: number;
}

function logReadFailure(context: string, error: unknown): void {
  const message = error instanceof NvdApiError ? `[${error.kind}] ${error.message}` : String(error);
  console.error(`[lib/nvd] ${context} failed: ${message}`);
}

function localSearch(params: SearchCVEParams): PaginatedResult<CVE> {
  try {
    return CveRepository.search(params);
  } catch (error) {
    logReadFailure("SQLite catalog search", error);
    const pageSize = Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE);
    return unavailableSearchResult(pageSize, params.page);
  }
}

export async function getLatestCVEs(limit = 6, _preferSynced = false): Promise<CVE[]> {
  void _preferSynced;
  if (isNeonCveConfigured()) {
    try { return await getNeonLatestCves(limit); }
    catch (error) { logReadFailure("Neon latest CVEs", error); return []; }
  }
  return localSearch({ page: 1, pageSize: limit, sortBy: "publishedDate", sortOrder: "desc" }).results;
}

export async function getCriticalCVEs(limit = 4): Promise<CVE[]> {
  if (isNeonCveConfigured()) {
    try { return await getNeonLatestCves(limit, "CRITICAL"); }
    catch (error) { logReadFailure("Neon critical CVEs", error); return []; }
  }
  return localSearch({ severity: ["CRITICAL"], page: 1, pageSize: limit }).results;
}

export async function getHighCVEs(limit = 4): Promise<CVE[]> {
  if (isNeonCveConfigured()) {
    try { return await getNeonLatestCves(limit, "HIGH"); }
    catch (error) { logReadFailure("Neon high CVEs", error); return []; }
  }
  return localSearch({ severity: ["HIGH"], page: 1, pageSize: limit }).results;
}

export async function getRecentCVEs(limit = 6): Promise<CVE[]> {
  if (isNeonCveConfigured()) {
    try {
      const sql = getNeonCveClient();
      if (!sql) return [];
      const rows = await sql.query("SELECT payload FROM infocve_cves WHERE vuln_status <> 'Rejected' ORDER BY last_modified_date DESC LIMIT $1", [limit]) as Array<{ payload: CVE }>;
      return rows.map((row) => row.payload);
    } catch (error) { logReadFailure("Neon recently modified CVEs", error); return []; }
  }
  return localSearch({ page: 1, pageSize: limit, sortBy: "lastModifiedDate", sortOrder: "desc" }).results;
}

/** Look in the persistent catalog first. Only exact-ID detail requests fall back to NVD live. */
export async function getCVEById(id: string): Promise<CVE | null> {
  const normalizedId = id.trim().toUpperCase();
  if (!/^CVE-\d{4}-\d{4,}$/.test(normalizedId)) return null;
  try {
    const stored = isNeonCveConfigured() ? await getNeonCveById(normalizedId) : CveRepository.getById(normalizedId);
    if (stored) return stored;
  } catch (error) {
    logReadFailure(`catalog detail ${normalizedId}`, error);
  }

  const response = await fetchNvd({ cveId: normalizedId }, { revalidateSeconds: 6 * 60 * 60, tags: [`nvd:cve:${normalizedId}`] });
  const record: NvdCveRecord | undefined = response.vulnerabilities[0]?.cve;
  if (!record) return null;
  return fillMissingCveEntities({
    ...normalizeNvdCve(record),
    sourceObservations: [{
      sourceId: "NVD",
      recordUrl: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(normalizedId)}`,
      accessedAt: new Date().toISOString(),
    }],
  });
}

export async function searchCVEs(params: SearchCVEParams = {}): Promise<PaginatedResult<CVE>> {
  if (isNeonCveConfigured()) {
    try { return await searchNeonCves(params); }
    catch (error) {
      logReadFailure("Neon search", error);
      const pageSize = Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE);
      return unavailableSearchResult(pageSize, params.page);
    }
  }
  return localSearch(params);
}

export async function getCVEsByVendor(vendorName: string, limit?: number): Promise<CVE[]> {
  return (await searchCVEs({ vendor: [vendorName], pageSize: limit ?? 100 })).results;
}

export async function getCVEsByProduct(productName: string, limit?: number): Promise<CVE[]> {
  return (await searchCVEs({ product: [productName], pageSize: limit ?? 100 })).results;
}

export async function getCVEsByYear(year: number, limit = 50): Promise<CVE[]> {
  return (await searchCVEs({ year: [year], pageSize: Math.min(limit, 100) })).results;
}

export async function getVendors(limit?: number, params: SearchCVEParams = {}): Promise<FacetCount[]> {
  try {
    const values = isNeonCveConfigured()
      ? (await getNeonFacetCounts(params)).vendors
      : CveRepository.getFacetCounts(params).vendors;
    return limit ? values.slice(0, limit) : values;
  } catch (error) { logReadFailure("vendor facets", error); return []; }
}

export async function getProducts(limit?: number, params: SearchCVEParams = {}): Promise<FacetCount[]> {
  try {
    const values = isNeonCveConfigured()
      ? (await getNeonFacetCounts(params)).products
      : CveRepository.getFacetCounts(params).products;
    return limit ? values.slice(0, limit) : values;
  } catch (error) { logReadFailure("product facets", error); return []; }
}

export async function getAvailableYears(params: SearchCVEParams = {}): Promise<number[]> {
  try {
    return isNeonCveConfigured()
      ? (await getNeonFacetCounts(params)).years
      : CveRepository.getFacetCounts(params).years;
  } catch (error) { logReadFailure("year facets", error); return []; }
}

export async function getAvailableCWEs(params: SearchCVEParams = {}): Promise<{ id: string; name: string }[]> {
  try {
    const values = isNeonCveConfigured()
      ? (await getNeonFacetCounts(params)).cwes
      : CveRepository.getFacetCounts(params).cwes;
    return values.map(({ id, name }) => ({ id, name: name || getCweName(id) }));
  } catch (error) { logReadFailure("CWE facets", error); return []; }
}

export async function getCategories(params: SearchCVEParams = {}): Promise<(SecurityCategory & { count: number })[]> {
  try {
    const rows = isNeonCveConfigured()
      ? await getNeonCategoryCounts(params)
      : CveRepository.getFacetCounts(params).categories;
    return rows.flatMap(({ slug, count }) => {
      const meta = CATEGORY_META[slug as keyof typeof CATEGORY_META];
      return meta ? [{ slug: slug as keyof typeof CATEGORY_META, count, ...meta }] : [];
    });
  } catch (error) { logReadFailure("category facets", error); return []; }
}

export async function getStats(): Promise<{ total: number; critical: number; high: number; vendors: number; available: boolean }> {
  try {
    const stats = isNeonCveConfigured() ? await getNeonStats() : CveRepository.getStats();
    return { total: stats.total, critical: stats.critical, high: stats.high, vendors: stats.vendors, available: stats.total > 0 };
  } catch (error) {
    logReadFailure("catalog stats", error);
    return { total: 0, critical: 0, high: 0, vendors: 0, available: false };
  }
}
