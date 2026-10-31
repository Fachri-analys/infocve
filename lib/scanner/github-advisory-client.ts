import "server-only";

import { isSafeUrl } from "@/lib/security";

export interface GithubAdvisoryVulnerability {
  package: { ecosystem: string; name: string; purl?: string };
  vulnerableVersionRange: string;
  firstPatchedVersion: string | null;
}

export interface GithubAdvisory {
  id: string;
  cveId: string | null;
  updatedAt: string | null;
  fetchedAt: string;
  url: string;
  vulnerabilities: GithubAdvisoryVulnerability[];
  references: string[];
}

export interface GithubAdvisoryResult {
  advisories: Map<string, GithubAdvisory>;
  errors: string[];
  attempts: Map<string, number>;
}

const GHSA_ID = /^GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}$/i;
const API = "https://api.github.com/advisories";
const MAX_IDS = 20;
const CONCURRENCY = 4;

/** Cross-check only canonical GHSA IDs returned by OSV; never search or fuzzy-match package names. */
export async function queryGithubAdvisories(
  ids: string[],
  options: { fetcher?: typeof fetch; token?: string; delayMs?: number; now?: () => string } = {}
): Promise<GithubAdvisoryResult> {
  const unique = Array.from(new Set(ids.map((id) => id.toUpperCase()).filter((id) => GHSA_ID.test(id))));
  const errors: string[] = [];
  const advisories = new Map<string, GithubAdvisory>();
  const attempts = new Map<string, number>();
  if (unique.length > MAX_IDS) errors.push(`GitHub Security Advisories cross-check is limited to ${MAX_IDS} advisories; remaining records were not checked.`);
  const fetcher = options.fetcher ?? fetch;
  const token = options.token ?? process.env.GITHUB_TOKEN;

  for (let start = 0; start < Math.min(unique.length, MAX_IDS); start += CONCURRENCY) {
    const chunk = unique.slice(start, start + CONCURRENCY);
    const loaded = await Promise.all(chunk.map(async (id) => {
      let lastStatus: number | undefined;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        attempts.set(id, attempt);
        try {
          const response = await fetcher(`${API}/${encodeURIComponent(id)}`, {
            headers: {
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: AbortSignal.timeout(2_500),
            cache: "no-store",
          });
          if (response.ok) {
            const payload: unknown = await response.json();
            const advisory = parseAdvisory(payload, id, options.now?.() ?? new Date().toISOString());
            return advisory ? { advisory } : { error: "invalid" as const };
          }
          lastStatus = response.status;
          if (response.status !== 429 && response.status < 500) return { error: "permanent" as const, status: response.status };
        } catch {
          lastStatus = undefined;
        }
        if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, options.delayMs ?? 100));
      }
      return { error: "transient" as const, status: lastStatus };
    }));

    for (let index = 0; index < loaded.length; index += 1) {
      const id = chunk[index]!;
      const item = loaded[index]!;
      if ("advisory" in item && item.advisory) advisories.set(id, item.advisory);
      else if (item.error === "invalid") errors.push(`GitHub Security Advisories returned invalid data for ${id}.`);
      else errors.push(`GitHub Security Advisories lookup failed for ${id} (${item.status ? `HTTP ${item.status}` : "network error"}).`);
    }
  }

  return { advisories, errors, attempts };
}

function parseAdvisory(value: unknown, expectedId: string, fetchedAt: string): GithubAdvisory | null {
  if (!isRecord(value) || typeof value.ghsa_id !== "string" || value.ghsa_id.toUpperCase() !== expectedId) return null;
  if (value.cve_id !== undefined && value.cve_id !== null && (typeof value.cve_id !== "string" || !/^CVE-\d{4}-\d{4,}$/i.test(value.cve_id))) return null;
  if (value.updated_at !== undefined && value.updated_at !== null && (typeof value.updated_at !== "string" || Number.isNaN(Date.parse(value.updated_at)))) return null;
  if (!Array.isArray(value.vulnerabilities) || value.vulnerabilities.length > 100) return null;
  const vulnerabilities: GithubAdvisoryVulnerability[] = [];
  for (const item of value.vulnerabilities) {
    if (!isRecord(item) || !isRecord(item.package) ||
      typeof item.package.ecosystem !== "string" || typeof item.package.name !== "string" ||
      item.package.ecosystem.length > 64 || item.package.name.length > 214 || !isNpmPackageName(item.package.name) ||
      typeof item.vulnerable_version_range !== "string" || item.vulnerable_version_range.length > 512) return null;
    const purl = item.package.purl;
    if (purl !== undefined && (typeof purl !== "string" || purl.length > 512)) return null;
    const patched = item.first_patched_version;
    if (patched !== undefined && patched !== null && (!isRecord(patched) || typeof patched.identifier !== "string" || patched.identifier.length > 128)) return null;
    vulnerabilities.push({
      package: { ecosystem: item.package.ecosystem, name: item.package.name, ...(typeof purl === "string" ? { purl } : {}) },
      vulnerableVersionRange: item.vulnerable_version_range,
      firstPatchedVersion: isRecord(patched) ? patched.identifier as string : null,
    });
  }
  const references = Array.isArray(value.references)
    ? value.references.flatMap((reference) => isRecord(reference) && typeof reference.url === "string" && reference.url.length <= 2048 && isSafeUrl(reference.url) ? [reference.url] : [])
    : [];
  return {
    id: expectedId,
    cveId: typeof value.cve_id === "string" ? value.cve_id.toUpperCase() : null,
    updatedAt: typeof value.updated_at === "string" ? value.updated_at : null,
    fetchedAt,
    url: `${API}/${encodeURIComponent(expectedId)}`,
    vulnerabilities,
    references: Array.from(new Set(references)),
  };
}

function isNpmPackageName(value: string): boolean {
  return /^(@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
