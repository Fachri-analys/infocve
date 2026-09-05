import { BaseVulnerabilitySource, SourceConfig, SourceMetadata } from "./base";
import type { CisaKevStatus, CVE } from "@/types/cve";

export interface CisaKevEntry {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate: string;
  knownRansomwareCampaignUse?: string;
  notes?: string;
}

export interface CisaKevResponse {
  title: string;
  catalogVersion: string;
  dateReleased: string;
  count: number;
  vulnerabilities: CisaKevEntry[];
}

const CISA_KEV_METADATA: SourceMetadata = {
  id: "CISA_KEV",
  name: "CISA Known Exploited Vulnerabilities Catalog",
  description: "Daftar resmi kerentanan keamanan yang telah terbukti dieksploitasi di dunia nyata oleh penyerang siber.",
  homepage: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
  license: "Public Domain (US Government)",
  updateFrequency: "Harian / Berkala",
};

export class CisaKevSourceAdapter extends BaseVulnerabilitySource<CisaKevResponse, CisaKevStatus> {
  private static cache: Map<string, CisaKevEntry> = new Map();
  private static lastFetched: number = 0;
  private static pendingPromise: Promise<Map<string, CisaKevEntry>> | null = null;
  private static readonly TTL_MS = 1000 * 60 * 60 * 4; // 4 hours

  private static readonly FEED_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

  constructor(config?: SourceConfig) {
    super(CISA_KEV_METADATA, {
      baseUrl: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
      cacheTtlSeconds: 14400, // 4 hours
      timeoutMs: 15000,
      rateLimit: { maxRequests: 30, windowMs: 60000 },
      ...config,
    });
  }

  /** For test harness only: clear in-memory state */
  static resetState(): void {
    CisaKevSourceAdapter.cache = new Map();
    CisaKevSourceAdapter.lastFetched = 0;
    CisaKevSourceAdapter.pendingPromise = null;
  }

  /**
   * Fetch the full CISA KEV catalog with in-memory caching and in-flight request deduplication
   * to ensure minimal network requests to CISA CDN.
   */
  async fetchCatalog(): Promise<Map<string, CisaKevEntry>> {
    const now = Date.now();
    if (CisaKevSourceAdapter.cache.size > 0 && now - CisaKevSourceAdapter.lastFetched < CisaKevSourceAdapter.TTL_MS) {
      return CisaKevSourceAdapter.cache;
    }

    if (CisaKevSourceAdapter.pendingPromise) {
      return CisaKevSourceAdapter.pendingPromise;
    }

    CisaKevSourceAdapter.pendingPromise = (async () => {
      try {
        const feedUrl = this.config.baseUrl || CisaKevSourceAdapter.FEED_URL;
        const data = await this.fetchHttp<unknown>(feedUrl, {
          next: { revalidate: this.config.cacheTtlSeconds, tags: ["cisa-kev"] },
        });

        if (
          !data ||
          typeof data !== "object" ||
          !("vulnerabilities" in data) ||
          !Array.isArray((data as { vulnerabilities: unknown }).vulnerabilities)
        ) {
          return CisaKevSourceAdapter.cache;
        }

        const response = data as CisaKevResponse;
        const map = new Map<string, CisaKevEntry>();
        for (const vuln of response.vulnerabilities || []) {
          if (vuln && vuln.cveID) {
            map.set(vuln.cveID.trim().toUpperCase(), vuln);
          }
        }

        CisaKevSourceAdapter.cache = map;
        CisaKevSourceAdapter.lastFetched = Date.now();
        return map;
      } catch (err) {
        console.error("[CISA_KEV] Failed to fetch catalog feed:", err);
        return CisaKevSourceAdapter.cache;
      } finally {
        CisaKevSourceAdapter.pendingPromise = null;
      }
    })();

    return CisaKevSourceAdapter.pendingPromise;
  }

  async fetchById(cveId: string): Promise<CisaKevStatus | null> {
    const normalizedId = cveId?.trim().toUpperCase();
    if (!normalizedId || !/^CVE-\d{4}-\d{4,}$/.test(normalizedId)) {
      return null;
    }

    try {
      const map = await this.fetchCatalog();
      const entry = map.get(normalizedId);
      if (!entry) {
        return { isKev: false };
      }

      return {
        isKev: true,
        dateAdded: entry.dateAdded,
        dueDate: entry.dueDate,
        requiredAction: entry.requiredAction,
        notes: entry.notes,
      };
    } catch {
      return { isKev: false };
    }
  }

  async fetchLatest(limit = 10): Promise<CisaKevEntry[]> {
    const map = await this.fetchCatalog();
    return Array.from(map.values()).slice(0, limit);
  }

  async testConnection(): Promise<boolean> {
    try {
      const map = await this.fetchCatalog();
      return map.size > 0;
    } catch {
      return false;
    }
  }

  override async enrichCve(cve: CVE): Promise<CVE> {
    const status = await this.fetchById(cve.id).catch(() => null);
    if (!status || !status.isKev) {
      return {
        ...cve,
        cisaKev: status || { isKev: false },
      };
    }

    const sources = new Set(cve.sources || ["NVD"]);
    sources.add("CISA_KEV");

    return {
      ...cve,
      cisaKev: status,
      hasPoc: cve.hasPoc || true,
      sources: Array.from(sources),
    };
  }
}
