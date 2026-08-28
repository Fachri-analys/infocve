import { VulnerabilitySourceAdapter, SourceMetadata } from "./base";
import type { EPSSScore } from "@/types/cve";

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

export class EpssSourceAdapter implements VulnerabilitySourceAdapter {
  metadata: SourceMetadata = {
    id: "EPSS",
    name: "FIRST Exploit Prediction Scoring System (EPSS)",
    description: "Model probabilitas berbasis data untuk memprediksi kemungkinan suatu kerentanan dieksploitasi dalam 30 hari ke depan.",
    homepage: "https://www.first.org/epss/",
    license: "Open Data (FIRST.org)",
    updateFrequency: "Harian",
  };

  private static readonly API_BASE = "https://api.first.org/data/v1/epss";

  async fetchById(cveId: string): Promise<EPSSScore | null> {
    try {
      const url = `${EpssSourceAdapter.API_BASE}?cve=${encodeURIComponent(cveId.toUpperCase())}`;
      const response = await fetch(url, {
        next: { revalidate: 86400 }, // 24h
        headers: { "User-Agent": "InfoCVE/0.1.0" },
      });

      if (!response.ok) return null;

      const json = (await response.json()) as EpssApiResponse;
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
      const url = `${EpssSourceAdapter.API_BASE}?cve=${encodeURIComponent(queryList)}`;
      const response = await fetch(url, {
        next: { revalidate: 86400 },
        headers: { "User-Agent": "InfoCVE/0.1.0" },
      });

      if (!response.ok) return result;

      const json = (await response.json()) as EpssApiResponse;
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
      const url = `${EpssSourceAdapter.API_BASE}?limit=${limit}&order=desc`;
      const response = await fetch(url, { next: { revalidate: 86400 } });
      if (!response.ok) return [];
      const json = (await response.json()) as EpssApiResponse;
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
}
