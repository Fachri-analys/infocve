import { BaseVulnerabilitySource, SourceConfig, SourceMetadata } from "./base";
import { PocClassifier } from "./poc";
import type { CVE } from "@/types/cve";

export interface GhsaAdvisory {
  ghsaId: string;
  cveId?: string;
  summary: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  publishedAt: string;
  updatedAt: string;
  ecosystem: string;
  packageName: string;
  vulnerableVersionRange: string;
  patchedVersions: string;
  references: string[];
}

interface RawGhsaItem {
  ghsa_id: string;
  cve_id?: string;
  summary?: string;
  description?: string;
  severity?: string;
  published_at: string;
  updated_at: string;
  vulnerabilities?: Array<{
    package?: {
      ecosystem?: string;
      name?: string;
    };
    vulnerable_version_range?: string;
    first_patched_version?: string;
  }>;
  references?: Array<{ url?: string } | string>;
}

const GHSA_METADATA: SourceMetadata = {
  id: "GHSA",
  name: "GitHub Security Advisories (GHSA)",
  description: "Basis data advisori keamanan ekosistem open-source (npm, PyPI, Maven, Go, Cargo, dll.) dari GitHub.",
  homepage: "https://github.com/advisories",
  license: "CC-BY 4.0",
  updateFrequency: "Harian / Real-time",
};

export class GhsaSourceAdapter extends BaseVulnerabilitySource<RawGhsaItem[], GhsaAdvisory> {
  private static readonly API_BASE = "https://api.github.com/advisories";

  constructor(config?: SourceConfig) {
    super(GHSA_METADATA, {
      baseUrl: "https://api.github.com/advisories",
      apiKey: process.env.GITHUB_TOKEN,
      authHeaderName: "Authorization",
      authHeaderPrefix: "Bearer",
      cacheTtlSeconds: 43200,
      timeoutMs: 10000,
      rateLimit: { maxRequests: 60, windowMs: 60000 },
      ...config,
    });
  }

  protected override async fetchHttp<T = RawGhsaItem[]>(url: string, init?: RequestInit): Promise<T> {
    const customHeaders = {
      Accept: "application/vnd.github+json",
      ...(init?.headers || {}),
    };
    return super.fetchHttp<T>(url, { ...init, headers: customHeaders });
  }

  async fetchByCve(cveId: string): Promise<GhsaAdvisory | null> {
    try {
      const url = `${this.config.baseUrl || GhsaSourceAdapter.API_BASE}?cve_id=${encodeURIComponent(cveId.toUpperCase())}`;
      const data = await this.fetchHttp<RawGhsaItem[]>(url);
      const item = data?.[0];
      if (!item) return null;

      return {
        ghsaId: item.ghsa_id,
        cveId: item.cve_id,
        summary: item.summary || "",
        description: item.description || "",
        severity: ((item.severity || "MEDIUM").toUpperCase() as GhsaAdvisory["severity"]),
        publishedAt: item.published_at,
        updatedAt: item.updated_at,
        ecosystem: item.vulnerabilities?.[0]?.package?.ecosystem || "General",
        packageName: item.vulnerabilities?.[0]?.package?.name || "",
        vulnerableVersionRange: item.vulnerabilities?.[0]?.vulnerable_version_range || "",
        patchedVersions: item.vulnerabilities?.[0]?.first_patched_version || "",
        references: (item.references || []).map((r) => (typeof r === "string" ? r : r.url || "")).filter(Boolean),
      };
    } catch (err) {
      console.error(`[GHSA] Fetch error for ${cveId}:`, err);
      return null;
    }
  }

  async fetchById(id: string): Promise<GhsaAdvisory | null> {
    return this.fetchByCve(id);
  }

  async fetchLatest(limit = 10): Promise<GhsaAdvisory[]> {
    try {
      const url = `${this.config.baseUrl || GhsaSourceAdapter.API_BASE}?per_page=${limit}`;
      const data = await this.fetchHttp<RawGhsaItem[]>(url);
      return (data || []).map((item) => ({
        ghsaId: item.ghsa_id,
        cveId: item.cve_id,
        summary: item.summary || "",
        description: item.description || "",
        severity: ((item.severity || "MEDIUM").toUpperCase() as GhsaAdvisory["severity"]),
        publishedAt: item.published_at,
        updatedAt: item.updated_at,
        ecosystem: item.vulnerabilities?.[0]?.package?.ecosystem || "General",
        packageName: item.vulnerabilities?.[0]?.package?.name || "",
        vulnerableVersionRange: item.vulnerabilities?.[0]?.vulnerable_version_range || "",
        patchedVersions: item.vulnerabilities?.[0]?.first_patched_version || "",
        references: [],
      }));
    } catch {
      return [];
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const adv = await this.fetchByCve("CVE-2021-44228");
      return adv !== null;
    } catch {
      return false;
    }
  }

  override async enrichCve(cve: CVE): Promise<CVE> {
    const ghsa = await this.fetchByCve(cve.id).catch(() => null);
    if (!ghsa || ghsa.references.length === 0) return cve;

    const sources = new Set(cve.sources || ["NVD"]);
    sources.add("GHSA");

    const enrichedRefs = [...cve.references];
    for (const ghsaRef of ghsa.references) {
      if (!enrichedRefs.some((r) => r.url === ghsaRef)) {
        const { isExploit, isPoc } = PocClassifier.classifyReference({ url: ghsaRef, source: "GitHub Advisory" });
        enrichedRefs.push({
          url: ghsaRef,
          source: "GitHub Advisory",
          tags: ["Advisory"],
          isExploit,
          isPoc,
        });
      }
    }

    return {
      ...cve,
      references: enrichedRefs,
      sources: Array.from(sources),
    };
  }
}
