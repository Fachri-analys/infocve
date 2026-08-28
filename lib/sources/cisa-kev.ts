import { VulnerabilitySourceAdapter, SourceMetadata } from "./base";
import type { CisaKevStatus } from "@/types/cve";

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

export class CisaKevSourceAdapter implements VulnerabilitySourceAdapter {
  metadata: SourceMetadata = {
    id: "CISA_KEV",
    name: "CISA Known Exploited Vulnerabilities Catalog",
    description: "Daftar resmi kerentanan keamanan yang telah terbukti dieksploitasi di dunia nyata oleh penyerang siber.",
    homepage: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    license: "Public Domain (US Government)",
    updateFrequency: "Harian / Berkala",
  };

  private static cache: Map<string, CisaKevEntry> = new Map();
  private static lastFetched: number = 0;
  private static readonly TTL_MS = 1000 * 60 * 60 * 4; // 4 hours

  private static readonly FEED_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

  async fetchCatalog(): Promise<Map<string, CisaKevEntry>> {
    const now = Date.now();
    if (CisaKevSourceAdapter.cache.size > 0 && now - CisaKevSourceAdapter.lastFetched < CisaKevSourceAdapter.TTL_MS) {
      return CisaKevSourceAdapter.cache;
    }

    try {
      const response = await fetch(CisaKevSourceAdapter.FEED_URL, {
        next: { revalidate: 14400 },
        headers: { "User-Agent": "InfoCVE/0.1.0" },
      });

      if (!response.ok) {
        throw new Error(`CISA KEV HTTP error: ${response.status}`);
      }

      const data = (await response.json()) as CisaKevResponse;
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
}
