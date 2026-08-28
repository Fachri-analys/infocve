import { CveRepository } from "@/lib/db/cve-repository";
import { getCVEById } from "@/lib/nvd";
import { ThreatIntelligenceAggregator } from "@/lib/sources/aggregator";
import type { CVE, PaginatedResult, SearchCVEParams } from "@/types/cve";

export interface SbomPackage {
  name: string;
  version: string;
  ecosystem?: string;
}

export interface SbomScanMatch {
  package: SbomPackage;
  cves: CVE[];
  highestSeverity?: string;
}

export interface ThreatIntelligenceReport {
  cveId: string;
  cvssScore: number;
  severity: string;
  epssProbability?: number;
  cisaKevActive: boolean;
  hasPublicPoc: boolean;
  recommendedAction: string;
  sources: string[];
}

/**
 * Local Agent Tool Interface — Designed for AI coding agents & automated pipeline scanning
 */
export class InfoCveLocalAgent {
  /**
   * Look up a vulnerability by CVE ID with full multi-source intelligence
   */
  static async queryVulnerability(cveId: string): Promise<CVE | null> {
    const normalized = cveId.trim().toUpperCase();

    // 1. Check local database first
    const cached = CveRepository.getById(normalized);
    if (cached) {
      return cached;
    }

    // 2. Fetch live and enrich if not in local db
    const live = await getCVEById(normalized);
    if (!live) return null;

    return await ThreatIntelligenceAggregator.enrich(live, true);
  }

  /**
   * Get synthesized Threat Intelligence Summary for risk analysis
   */
  static async getThreatIntelligence(cveId: string): Promise<ThreatIntelligenceReport | null> {
    const cve = await this.queryVulnerability(cveId);
    if (!cve) return null;

    let recommendedAction = "Terapkan pembaruan perangkat lunak versi terbaru yang telah dipatch.";
    if (cve.cisaKev?.isKev) {
      recommendedAction = `🚨 Prioritas Kritis (CISA KEV): ${cve.cisaKev.requiredAction || "Segera mitigasi atau putuskan sistem dari jaringan jika belum ditambal."}`;
    } else if (cve.cvss.severity === "CRITICAL" && (cve.hasPoc || (cve.epss?.score && cve.epss.score > 0.5))) {
      recommendedAction = "Prioritas Sangat Tinggi: Kerentanan kritis dengan exploit aktif/probabilitas tinggi tersedia.";
    }

    return {
      cveId: cve.id,
      cvssScore: cve.cvss.baseScore,
      severity: cve.cvss.severity,
      epssProbability: cve.epss?.score,
      cisaKevActive: cve.cisaKev?.isKev ?? false,
      hasPublicPoc: cve.hasPoc ?? false,
      recommendedAction,
      sources: cve.sources || ["NVD"],
    };
  }

  /**
   * Scan an SBOM (Software Bill of Materials) list of dependencies
   */
  static async scanSbom(packages: SbomPackage[]): Promise<SbomScanMatch[]> {
    const results: SbomScanMatch[] = [];

    for (const pkg of packages) {
      const searchRes = CveRepository.search({
        query: pkg.name,
        pageSize: 10,
      });

      if (searchRes.results.length > 0) {
        results.push({
          package: pkg,
          cves: searchRes.results,
          highestSeverity: searchRes.results[0]?.cvss.severity,
        });
      }
    }

    return results;
  }

  /**
   * Search local threat database
   */
  static searchDatabase(params: SearchCVEParams): PaginatedResult<CVE> {
    return CveRepository.search(params);
  }
}
