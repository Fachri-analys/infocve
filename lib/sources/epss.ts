import { BaseVulnerabilitySource, SourceConfig, SourceMetadata } from "./base";
import type { CVE, EPSSScore } from "@/types/cve";

export interface EpssApiResponseItem {
  cve: string;
  epss: string;
  percentile: string;
  date: string;
}

export interface EpssApiResponse {
  status: string;
  "status-code": number;
  total: number;
  data: EpssApiResponseItem[];
}

const EPSS_METADATA: SourceMetadata = {
  id: "EPSS",
  name: "FIRST Exploit Prediction Scoring System (EPSS)",
  description: "Model probabilitas berbasis data untuk memprediksi kemungkinan suatu kerentanan dieksploitasi dalam 30 hari ke depan.",
  homepage: "https://www.first.org/epss/",
  license: "Open Data (FIRST.org)",
  updateFrequency: "Harian",
};

export class EpssSourceAdapter extends BaseVulnerabilitySource<EpssApiResponse, EPSSScore> {
  private static readonly API_BASE = "https://api.first.org/data/v1/epss";

  constructor(config?: SourceConfig) {
    super(EPSS_METADATA, {
      baseUrl: "https://api.first.org/data/v1/epss",
      cacheTtlSeconds: 86400,
      timeoutMs: 10000,
      rateLimit: { maxRequests: 100, windowMs: 60000 },
      ...config,
    });
  }

  async fetchById(cveId: string): Promise<EPSSScore | null> {
    try {
      const url = `${this.config.baseUrl || EpssSourceAdapter.API_BASE}?cve=${encodeURIComponent(cveId.toUpperCase())}`;
      const json = await this.fetchHttp<EpssApiResponse>(url);
      const item = json.data?.[0];
      if (!item) return null;

      return {
        score: parseFloat(item.epss),
        percentile: parseFloat(item.percentile),
        date: item.date,
      };
    } catch (err) {
      console.error(`[EPSS] Failed to fetch score for ${cveId}:`, err);
      return null;
    }
  }

  async fetchBatch(cveIds: string[]): Promise<Map<string, EPSSScore>> {
    const result = new Map<string, EPSSScore>();
    if (cveIds.length === 0) return result;

    try {
      const queryList = cveIds.slice(0, 100).join(",");
      const url = `${this.config.baseUrl || EpssSourceAdapter.API_BASE}?cve=${encodeURIComponent(queryList)}`;
      const json = await this.fetchHttp<EpssApiResponse>(url);

      for (const item of json.data || []) {
        result.set(item.cve.toUpperCase(), {
          score: parseFloat(item.epss),
          percentile: parseFloat(item.percentile),
          date: item.date,
        });
      }
    } catch (err) {
      console.error("[EPSS] Batch fetch error:", err);
    }
    return result;
  }

  async fetchLatest(limit = 10): Promise<EpssApiResponseItem[]> {
    try {
      const url = `${this.config.baseUrl || EpssSourceAdapter.API_BASE}?limit=${limit}&order=desc`;
      const json = await this.fetchHttp<EpssApiResponse>(url);
      return json.data || [];
    } catch {
      return [];
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const score = await this.fetchById("CVE-2021-44228");
      return score !== null;
    } catch {
      return false;
    }
  }

  override async enrichCve(cve: CVE): Promise<CVE> {
    const score = await this.fetchById(cve.id).catch(() => null);
    if (!score) return cve;

    const sources = new Set(cve.sources || ["NVD"]);
    sources.add("EPSS");

    return {
      ...cve,
      epss: score,
      sources: Array.from(sources),
    };
  }
}
