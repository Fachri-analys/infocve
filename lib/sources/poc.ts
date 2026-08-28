import { CVEReference } from "@/types/cve";

/**
 * Intelligent classifier for Proof-of-Concept (PoC) and Exploit references.
 * Purely informational metadata classification — never executes any external code.
 */

const KNOWN_EXPLOIT_DOMAINS = [
  "exploit-db.com",
  "packetstormsecurity.com",
  "0day.today",
  "cxsecurity.com",
  "sploitus.com",
  "metasploit.com",
  "rapid7.com/db/modules",
  "vulners.com/exploitdb",
];

const POC_URL_PATTERNS = [
  /github\.com\/[a-zA-Z0-9_-]+\/(?:cve-\d{4}-\d+|.*poc.*|.*exploit.*)/i,
  /gist\.github\.com\/[a-zA-Z0-9_-]+\/[a-f0-9]+/i,
  /gitlab\.com\/[a-zA-Z0-9_-]+\/(?:cve-\d{4}-\d+|.*poc.*)/i,
  /project-zero\.issues\.chromium\.org/i,
  /googleprojectzero\.blogspot\.com/i,
  /seclists\.org\/fulldisclosure/i,
  /openwall\.com\/lists\/oss-security/i,
];

export class PocClassifier {
  /**
   * Classify if a reference is an Exploit or Proof-of-Concept
   */
  static classifyReference(ref: CVEReference): { isExploit: boolean; isPoc: boolean; reason?: string } {
    const url = (ref.url || "").toLowerCase();
    const source = (ref.source || "").toLowerCase();
    const tags = (ref.tags || []).map((t) => t.toLowerCase());

    // 1. Tag check (from NVD or other source)
    if (tags.includes("exploit")) {
      return { isExploit: true, isPoc: true, reason: "Tagged as Exploit" };
    }
    if (tags.some((t) => t.includes("poc") || t.includes("proof of concept"))) {
      return { isExploit: false, isPoc: true, reason: "Tagged as PoC" };
    }

    // 2. Known Exploit databases
    for (const domain of KNOWN_EXPLOIT_DOMAINS) {
      if (url.includes(domain)) {
        return { isExploit: true, isPoc: true, reason: `Found in ${domain}` };
      }
    }

    // 3. GitHub PoC patterns
    for (const pattern of POC_URL_PATTERNS) {
      if (pattern.test(url)) {
        return { isExploit: false, isPoc: true, reason: "Public PoC repository / disclosure advisory" };
      }
    }

    // 4. Source text hints
    if (source.includes("exploit") || source.includes("metasploit")) {
      return { isExploit: true, isPoc: true, reason: "Source contains Exploit designation" };
    }

    return { isExploit: false, isPoc: false };
  }

  /**
   * Enrich a list of references with exploit and PoC flags
   */
  static enrichReferences(references: CVEReference[]): { enriched: CVEReference[]; hasPoc: boolean; hasExploit: boolean } {
    let hasPoc = false;
    let hasExploit = false;

    const enriched = references.map((ref) => {
      const { isExploit, isPoc } = this.classifyReference(ref);
      if (isPoc) hasPoc = true;
      if (isExploit) hasExploit = true;

      return {
        ...ref,
        isExploit: ref.isExploit || isExploit,
        isPoc: ref.isPoc || isPoc,
      };
    });

    return { enriched, hasPoc, hasExploit };
  }
}
