import "server-only";

import type { DependencyPackage } from "./npm-manifest";
import type { OsvRange } from "./npm-semver";

export interface OsvReference {
  type: string;
  url: string;
}

export interface OsvAffected {
  package?: { name?: string; ecosystem?: string; purl?: string };
  versions?: string[];
  ranges?: OsvRange[];
  severity?: Array<{ type?: string; score?: string }>;
  ecosystem_specific?: Record<string, unknown>;
  database_specific?: Record<string, unknown>;
}

export interface OsvVulnerability {
  id: string;
  fetchedAt?: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  affected?: OsvAffected[];
  references?: OsvReference[];
  severity?: Array<{ type?: string; score?: string }>;
  database_specific?: Record<string, unknown>;
  modified?: string;
}

export interface OsvPackageResult {
  packageKey: string;
  vulnerabilities: OsvVulnerability[];
}

export interface OsvQueryResult {
  results: OsvPackageResult[];
  errors: string[];
  completedPackages: number;
  retryCount?: number;
}

const OSV_API = "https://api.osv.dev/v1";
const QUERY_BATCH_SIZE = 100;
const MAX_PAGES = 5;
const MAX_ADVISORY_IDS = 500;
const DETAIL_CONCURRENCY = 8;

export async function queryOsvPackages(packages: DependencyPackage[]): Promise<OsvQueryResult> {
  const errors: string[] = [];
  let retryCount = 0;
  const unique = new Map<string, DependencyPackage>();
  for (const item of packages) unique.set(packageKey(item), item);
  const packageResults = new Map<string, Set<string>>();
  const advisoryIds = new Set<string>();
  const requested = Array.from(unique.values());

  for (let start = 0; start < requested.length; start += QUERY_BATCH_SIZE) {
    const chunk = requested.slice(start, start + QUERY_BATCH_SIZE);
    let page = 0;
    let pending = chunk.map((item) => ({ item, pageToken: undefined as string | undefined }));
    while (pending.length > 0 && page < MAX_PAGES) {
      page += 1;
      try {
        const { response, retries } = await fetchWithRetry(`${OSV_API}/querybatch`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            queries: pending.map(({ item, pageToken }) => ({
              package: { ecosystem: "npm", name: item.name },
              version: item.version,
              ...(pageToken ? { page_token: pageToken } : {}),
            })),
          }),
          cache: "no-store",
        });
        retryCount += retries;
        if (!response) {
          errors.push(`Tidak dapat menghubungi OSV untuk kelompok dependency ${Math.floor(start / QUERY_BATCH_SIZE) + 1}.`);
          break;
        }
        if (!response.ok) {
          errors.push(`OSV querybatch gagal (HTTP ${response.status}) untuk kelompok dependency ${Math.floor(start / QUERY_BATCH_SIZE) + 1}.`);
          break;
        }
        const payload: unknown = await response.json();
        const results = readQueryResults(payload);
        if (!results || results.length !== pending.length) {
          errors.push("OSV mengembalikan respons querybatch yang tidak lengkap.");
          break;
        }
        const nextPage: typeof pending = [];
        for (let index = 0; index < results.length; index += 1) {
          const item = pending[index]!.item;
          const result = results[index]!;
          const key = packageKey(item);
          const ids = packageResults.get(key) ?? new Set<string>();
          for (const vulnerability of result.vulns ?? []) {
            if (typeof vulnerability.id !== "string" || !vulnerability.id) continue;
            if (!advisoryIds.has(vulnerability.id) && advisoryIds.size >= MAX_ADVISORY_IDS) {
              errors.push(`Hasil OSV melebihi batas ${MAX_ADVISORY_IDS} advisori; sebagian data tidak diproses.`);
              continue;
            }
            ids.add(vulnerability.id);
            advisoryIds.add(vulnerability.id);
          }
          packageResults.set(key, ids);
          if (result.next_page_token) nextPage.push({ item, pageToken: result.next_page_token });
        }
        pending = nextPage;
      } catch {
        errors.push(`Tidak dapat menghubungi OSV untuk kelompok dependency ${Math.floor(start / QUERY_BATCH_SIZE) + 1}.`);
        break;
      }
    }
    if (pending.length > 0) errors.push("OSV memiliki halaman hasil lanjutan yang melewati batas pemindaian.");
  }

  const details = new Map<string, OsvVulnerability>();
  const ids = Array.from(advisoryIds);
  for (let start = 0; start < ids.length; start += DETAIL_CONCURRENCY) {
    const chunk = ids.slice(start, start + DETAIL_CONCURRENCY);
    const loaded = await Promise.all(chunk.map(async (id) => {
      try {
        const { response, retries } = await fetchWithRetry(`${OSV_API}/vulns/${encodeURIComponent(id)}`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response) return { id, retries, error: `detail advisori ${id} tidak dapat diambil` };
        if (!response.ok) return { id, retries, error: `detail advisori ${id} gagal (HTTP ${response.status})` };
        const payload: unknown = await response.json();
        if (!isOsvVulnerability(payload)) return { id, retries, error: `format detail advisori ${id} tidak valid` };
        return { id, retries, vulnerability: { ...payload, fetchedAt: new Date().toISOString() } };
      } catch {
        return { id, retries: 0, error: `detail advisori ${id} tidak dapat diambil` };
      }
    }));
    for (const result of loaded) {
      retryCount += result.retries;
      if (result.vulnerability) details.set(result.id, result.vulnerability);
      else errors.push(`OSV: ${result.error}.`);
    }
  }

  return {
    results: requested.map((item) => ({
      packageKey: packageKey(item),
      vulnerabilities: Array.from(packageResults.get(packageKey(item)) ?? [])
        .map((id) => details.get(id))
        .filter((vulnerability): vulnerability is OsvVulnerability => Boolean(vulnerability)),
    })),
    errors,
    completedPackages: packageResults.size,
    retryCount,
  };
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<{ response: Response | null; retries: number }> {
  let retries = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
      if (response.status !== 429 && response.status < 500) return { response, retries };
      if (attempt === 1) return { response, retries };
    } catch {
      if (attempt === 1) return { response: null, retries };
    }
    retries += 1;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return { response: null, retries };
}

export function packageKey(item: Pick<DependencyPackage, "name" | "version">): string {
  return `${item.name}\0${item.version}`;
}

function readQueryResults(payload: unknown): Array<{ vulns?: Array<{ id?: string }>; next_page_token?: string }> | null {
  if (!isRecord(payload) || !Array.isArray(payload.results)) return null;
  const results = payload.results;
  if (!results.every((item) => isRecord(item) &&
    (item.vulns === undefined || (Array.isArray(item.vulns) && item.vulns.every((vuln) => isRecord(vuln) && typeof vuln.id === "string"))) &&
    (item.next_page_token === undefined || typeof item.next_page_token === "string"))) return null;
  return results as Array<{ vulns?: Array<{ id?: string }>; next_page_token?: string }>;
}

function isOsvVulnerability(value: unknown): value is OsvVulnerability {
  if (!isRecord(value) || typeof value.id !== "string" || !Array.isArray(value.affected)) return false;
  if (value.aliases !== undefined && (!Array.isArray(value.aliases) || !value.aliases.every((alias) => typeof alias === "string"))) return false;
  if (value.summary !== undefined && typeof value.summary !== "string") return false;
  if (value.details !== undefined && typeof value.details !== "string") return false;
  if (value.severity !== undefined && !isSeverityList(value.severity)) return false;
  if (value.references !== undefined && (!Array.isArray(value.references) || !value.references.every((ref) =>
    isRecord(ref) && typeof ref.url === "string" && (ref.type === undefined || typeof ref.type === "string")))) return false;
  return value.affected.every((affected) => {
    if (!isRecord(affected)) return false;
    if (affected.package !== undefined && (!isRecord(affected.package) ||
      (affected.package.name !== undefined && typeof affected.package.name !== "string") ||
      (affected.package.ecosystem !== undefined && typeof affected.package.ecosystem !== "string") ||
      (affected.package.purl !== undefined && typeof affected.package.purl !== "string"))) return false;
    if (affected.versions !== undefined && (!Array.isArray(affected.versions) || !affected.versions.every((version) => typeof version === "string"))) return false;
    if (affected.ranges !== undefined && (!Array.isArray(affected.ranges) || !affected.ranges.every((range) =>
      isRecord(range) && typeof range.type === "string" && Array.isArray(range.events) && range.events.every((event) =>
        isRecord(event) && ["introduced", "fixed", "last_affected", "limit"].every((key) =>
          event[key] === undefined || typeof event[key] === "string"))))) return false;
    if (affected.severity !== undefined && !isSeverityList(affected.severity)) return false;
    return true;
  });
}

function isSeverityList(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => isRecord(item) &&
    (item.score === undefined || typeof item.score === "string") &&
    (item.type === undefined || typeof item.type === "string"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
