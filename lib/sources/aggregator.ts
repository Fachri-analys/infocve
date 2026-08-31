import { CVE } from "@/types/cve";
import { CisaKevSourceAdapter } from "./cisa-kev";
import { EpssSourceAdapter } from "./epss";
import { GhsaSourceAdapter } from "./ghsa";
import { PocClassifier } from "./poc";
import { CveRepository } from "@/lib/db/cve-repository";
import { sourceRegistry } from "./registry";

const cisaKevAdapter = new CisaKevSourceAdapter();
const epssAdapter = new EpssSourceAdapter();
const ghsaAdapter = new GhsaSourceAdapter();

// Register default auxiliary sources
sourceRegistry.register(cisaKevAdapter);
sourceRegistry.register(epssAdapter);
sourceRegistry.register(ghsaAdapter);

export interface EnrichedVulnerabilityIntelligence {
  cve: CVE;
  cisaKevFound: boolean;
  epssFound: boolean;
  ghsaFound: boolean;
  pocFound: boolean;
  sources: string[];
}

export class ThreatIntelligenceAggregator {
  /**
   * Enrich a normalized CVE with all available threat intelligence sources
   */
  static async enrich(cve: CVE, saveToDb = true): Promise<CVE> {
    const sourcesSet = new Set<string>(cve.sources || ["NVD"]);

    // 1. Parallel fetch from auxiliary intelligence feeds
    const [cisaKev, epss, ghsa] = await Promise.all([
      cisaKevAdapter.fetchById(cve.id).catch(() => null),
      epssAdapter.fetchById(cve.id).catch(() => null),
      ghsaAdapter.fetchByCve(cve.id).catch(() => null),
    ]);

    // 2. Classify references for PoC/Exploit presence
    const { enriched: enrichedRefs, hasPoc } = PocClassifier.enrichReferences(cve.references);

    // If GHSA provided additional references, merge them
    if (ghsa && ghsa.references.length > 0) {
      sourcesSet.add("GHSA");
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
    }

    if (cisaKev && cisaKev.isKev) {
      sourcesSet.add("CISA_KEV");
    }

    if (epss) {
      sourcesSet.add("EPSS");
    }

    const enrichedCve: CVE = {
      ...cve,
      references: enrichedRefs,
      cisaKev: cisaKev || cve.cisaKev,
      epss: epss || cve.epss,
      hasPoc: hasPoc || cve.hasPoc || (cisaKev?.isKev ?? false),
      sources: Array.from(sourcesSet),
    };

    // 3. Persist to local database with provenance tracking if requested
    if (saveToDb) {
      try {
        CveRepository.upsert(enrichedCve, "AGGREGATOR");
      } catch (err) {
        console.error(`[Aggregator] DB persistence error for ${cve.id}:`, err);
      }
    }

    return enrichedCve;
  }

  /**
   * Batch enrich a list of CVEs (e.g. for search results or recent lists)
   */
  static async enrichBatch(cves: CVE[], saveToDb = false): Promise<CVE[]> {
    if (cves.length === 0) return [];

    const cveIds = cves.map((c) => c.id);
    const [cisaCatalog, epssMap] = await Promise.all([
      cisaKevAdapter.fetchCatalog().catch(() => new Map()),
      epssAdapter.fetchBatch(cveIds).catch(() => new Map()),
    ]);

    const enriched = cves.map((cve) => {
      const sourcesSet = new Set<string>(cve.sources || ["NVD"]);
      const cisaEntry = cisaCatalog.get(cve.id.toUpperCase());
      const epss = epssMap.get(cve.id.toUpperCase());

      const { enriched: enrichedRefs, hasPoc } = PocClassifier.enrichReferences(cve.references);

      const cisaKev = cisaEntry
        ? {
            isKev: true,
            dateAdded: cisaEntry.dateAdded,
            dueDate: cisaEntry.dueDate,
            requiredAction: cisaEntry.requiredAction,
            notes: cisaEntry.notes,
          }
        : cve.cisaKev;

      if (cisaKev?.isKev) sourcesSet.add("CISA_KEV");
      if (epss) sourcesSet.add("EPSS");

      const enrichedItem: CVE = {
        ...cve,
        references: enrichedRefs,
        cisaKev,
        epss: epss || cve.epss,
        hasPoc: hasPoc || cve.hasPoc || (cisaKev?.isKev ?? false),
        sources: Array.from(sourcesSet),
      };

      if (saveToDb) {
        try {
          CveRepository.upsert(enrichedItem, "BATCH_SYNC");
        } catch {
          // ignore
        }
      }

      return enrichedItem;
    });

    return enriched;
  }
}
