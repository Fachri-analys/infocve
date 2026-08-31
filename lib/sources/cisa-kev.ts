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
  private static readonly TTL_MS = 1000 * 60 * 60 * 4; // 4 hours

  private static readonly FEED_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

  constructor(config?: SourceConfig) {
    super(CISA_KEV_METADATA, {
      cacheTtlSeconds: 14400,
      timeoutMs: 15000,
      ...config,
    });
  }

  async fetchCatalog(): Promise<Map<string, CisaKevEntry>> {
    const now = Date.now();
    if (CisaKevSourceAdapter.cache.size > 0 && now - CisaKevSourceAdapter.lastFetched < CisaKevSourceAdapter.TTL_MS) {
      return CisaKevSourceAdapter.cache;
    }

    try {
      const data = await this.fetchHttp<CisaKevResponse>(CisaKevSourceAdapter.FEED_URL);
      const map = new Map<string, CisaKevEntry>();
      for (const vuln of data.vulnerabilities || []) {
        map.set(vuln.cveID.toUpperCase(), vuln);
      }

      CisaKevSourceAdapter.cache = map;
      CisaKevSourceAdapter.lastFetched = now;
      return map;
    } catch (err) {
      console.error("[CISA_KEV] Failed to fetch catalog:", err);
      return CisaKevSourceAdapter.cache;
    }
  }

  async fetchById(cveId: string): Promise<CisaKevStatus | null> {
    const map = await this.fetchCatalog();
    const entry = map.get(cveId.toUpperCase());
    if (!entry) return null;

    return {
      isKev: true,
      dateAdded: entry.dateAdded,
      dueDate: entry.dueDate,
      requiredAction: entry.requiredAction,
      notes: entry.notes,
    };
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
    if (!status?.isKev) return cve;

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
