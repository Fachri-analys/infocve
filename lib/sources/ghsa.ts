import { VulnerabilitySourceAdapter, SourceMetadata } from "./base";

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

export class GhsaSourceAdapter implements VulnerabilitySourceAdapter {
  metadata: SourceMetadata = {
    id: "GHSA",
    name: "GitHub Security Advisories (GHSA)",
    description: "Basis data advisori keamanan ekosistem open-source (npm, PyPI, Maven, Go, Cargo, dll.) dari GitHub.",
    homepage: "https://github.com/advisories",
    license: "CC-BY 4.0",
    updateFrequency: "Harian / Real-time",
  };

  private static readonly API_BASE = "https://api.github.com/advisories";

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "InfoCVE/0.1.0",
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    return headers;
  }

  async fetchByCve(cveId: string): Promise<GhsaAdvisory | null> {
    try {
      const url = `${GhsaSourceAdapter.API_BASE}?cve_id=${encodeURIComponent(cveId.toUpperCase())}`;
      const response = await fetch(url, {
        next: { revalidate: 43200 }, // 12h
        headers: this.getHeaders(),
      });

      if (!response.ok) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await response.json()) as any[];
      const item = data?.[0];
      if (!item) return null;

      return {
        ghsaId: item.ghsa_id,
        cveId: item.cve_id,
        summary: item.summary || "",
        description: item.description || "",
        severity: (item.severity || "MEDIUM").toUpperCase(),
        publishedAt: item.published_at,
        updatedAt: item.updated_at,
        ecosystem: item.vulnerabilities?.[0]?.package?.ecosystem || "General",
        packageName: item.vulnerabilities?.[0]?.package?.name || "",
        vulnerableVersionRange: item.vulnerabilities?.[0]?.vulnerable_version_range || "",
        patchedVersions: item.vulnerabilities?.[0]?.first_patched_version || "",
        references: (item.references || []).map((r: { url?: string } | string) => (typeof r === "string" ? r : r.url || "")).filter(Boolean),
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
      const url = `${GhsaSourceAdapter.API_BASE}?per_page=${limit}`;
      const response = await fetch(url, {
        next: { revalidate: 43200 },
        headers: this.getHeaders(),
      });
      if (!response.ok) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await response.json()) as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data.map((item: any) => ({
        ghsaId: item.ghsa_id,
        cveId: item.cve_id,
        summary: item.summary || "",
        description: item.description || "",
        severity: (item.severity || "MEDIUM").toUpperCase(),
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
}
