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
      cacheTtlSeconds: 86400, // FIRST.org EPSS publishes updates once daily
      timeoutMs: 10000,
      rateLimit: { maxRequests: 100, windowMs: 60000 },
      ...config,
    });
  }

  /**
   * Validate and parse raw API response from FIRST.org EPSS
   */
  private parseEpssItem(item: unknown): EPSSScore | null {
    if (!item || typeof item !== "object") return null;

    const entry = item as Partial<EpssApiResponseItem>;
    if (typeof entry.epss !== "string" && typeof entry.epss !== "number") return null;
    if (typeof entry.percentile !== "string" && typeof entry.percentile !== "number") return null;

    const score = typeof entry.epss === "number" ? entry.epss : parseFloat(entry.epss);
    const percentile = typeof entry.percentile === "number" ? entry.percentile : parseFloat(entry.percentile);

    // Validate finite numbers and probability bounds [0.0, 1.0]
    if (
      !Number.isFinite(score) ||
      !Number.isFinite(percentile) ||
      score < 0 ||
      score > 1 ||
      percentile < 0 ||
      percentile > 1
    ) {
      return null;
    }

    return {
      score,
      percentile,
      date: typeof entry.date === "string" && entry.date ? entry.date : new Date().toISOString().split("T")[0],
    };
  }

  async fetchById(cveId: string): Promise<EPSSScore | null> {
    const normalizedId = cveId?.trim().toUpperCase();
    if (!normalizedId || !/^CVE-\d{4}-\d{4,}$/.test(normalizedId)) {
      return null;
    }

    try {
      const url = `${this.config.baseUrl || EpssSourceAdapter.API_BASE}?cve=${encodeURIComponent(normalizedId)}`;
      const json = await this.fetchHttp<unknown>(url);

      if (
        !json ||
        typeof json !== "object" ||
        !("status" in json) ||
        (json as { status: unknown }).status !== "OK" ||
        !("data" in json) ||
        !Array.isArray((json as { data: unknown }).data)
      ) {
        return null;
      }

      const response = json as EpssApiResponse;
      const matchingItem = response.data?.find((d) => d?.cve?.toUpperCase() === normalizedId) || response.data?.[0];
      if (!matchingItem) return null;

      return this.parseEpssItem(matchingItem);
    } catch {
      // Handles network errors, timeouts, rate limits, or non-200 responses gracefully
      return null;
    }
  }

  async fetchBatch(cveIds: string[]): Promise<Map<string, EPSSScore>> {
    const result = new Map<string, EPSSScore>();
    const validIds = cveIds
      .map((id) => id?.trim().toUpperCase())
      .filter((id) => /^CVE-\d{4}-\d{4,}$/.test(id));

    if (validIds.length === 0) return result;

    try {
      const queryList = validIds.slice(0, 100).join(",");
      const url = `${this.config.baseUrl || EpssSourceAdapter.API_BASE}?cve=${encodeURIComponent(queryList)}`;
      const json = await this.fetchHttp<unknown>(url);

      if (
        json &&
        typeof json === "object" &&
        "status" in json &&
        (json as { status: unknown }).status === "OK" &&
        "data" in json &&
        Array.isArray((json as { data: unknown }).data)
      ) {
        const response = json as EpssApiResponse;
        for (const item of response.data || []) {
          if (!item?.cve) continue;
          const parsed = this.parseEpssItem(item);
          if (parsed) {
            result.set(item.cve.toUpperCase(), parsed);
          }
        }
      }
    } catch {
      // Gracefully return partial or empty map on error
    }
    return result;
  }

  async fetchLatest(limit = 10): Promise<EpssApiResponseItem[]> {
    try {
      const url = `${this.config.baseUrl || EpssSourceAdapter.API_BASE}?limit=${limit}&order=desc`;
      const json = await this.fetchHttp<unknown>(url);
      if (
        json &&
        typeof json === "object" &&
        "data" in json &&
        Array.isArray((json as { data: unknown }).data)
      ) {
        return (json as EpssApiResponse).data || [];
      }
      return [];
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
