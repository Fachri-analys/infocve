import type {
  NvdConfiguration,
  NvdCpeMatch,
  NvdCveRecord,
  NvdCvssV2Data,
  NvdCvssV3Data,
  NvdCvssV40Data,
  NvdLangValue,
  NvdWeakness,
} from "@/lib/nvd-types";
import type { AffectedProduct, CVE, CVECategory, CVEReference, CVSSMetrics, CWEReference } from "@/types/cve";
import { getCweName } from "@/lib/cwe-catalog";
import { termDictionary } from "@/lib/dictionary";

/**
 * Maps a raw NVD API v2.0 CVE record onto this app's internal `CVE` model
 * (types/cve.ts). Every function below handles the "real API" realities the
 * mock data never had to: multiple CVSS versions, missing fields, CPE
 * strings instead of plain vendor/product text, and no human CWE names.
 *
 * Nothing here throws for "the data looks unusual" — a CVE with no CVSS
 * score yet, no configurations, or an unfamiliar CWE ID should still render
 * a complete page with honest fallbacks, not crash the request.
 */

// ---------------------------------------------------------------------------
// Description & title
// ---------------------------------------------------------------------------

function pickEnglishDescription(descriptions: NvdLangValue[]): string {
  const en = descriptions.find((d) => d.lang === "en");
  return (en ?? descriptions[0])?.value?.trim() || "Deskripsi tidak tersedia untuk CVE ini.";
}

/**
 * NVD gives no title field at all — this derives a short, honest one from
 * the description instead of inventing information NVD doesn't provide.
 * Strips the common "This CVE ID is unique from CVE-xxxx..." disambiguation
 * suffix NVD appends to related CVEs before truncating, so the title isn't
 * cut off mid-boilerplate.
 */
function deriveTitle(descriptionEn: string): string {
  const withoutSuffix = descriptionEn.replace(/\s*This CVE ID is unique from[\s\S]*$/i, "").trim();
  const source = withoutSuffix || descriptionEn;
  const maxLength = 100;
  if (source.length <= maxLength) return source;
  const truncated = source.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, lastSpace > 40 ? lastSpace : maxLength).trimEnd()}…`;
}

/**
 * A dictionary-assisted (NOT machine-translated) Indonesian aid: it can't
 * translate arbitrary English sentences — a fixed term dictionary
 * fundamentally can't do that — so instead it honestly surfaces which known
 * security terms (from `lib/dictionary.ts`) appear in the description, in
 * Indonesian, and points to the Glossary for the rest. This keeps faith with
 * the project's "dictionary-based, not AI-based" translation rule even
 * against arbitrary live API text.
 */
function buildIndonesianAssist(descriptionEn: string): string {
  const lower = descriptionEn.toLowerCase();
  const matches = Object.values(termDictionary).filter((entry) => lower.includes(entry.term.toLowerCase()));

  if (matches.length === 0) {
    return (
      "Deskripsi resmi (Bahasa Inggris) tersedia di atas. Belum ada istilah umum yang dikenali " +
      "secara otomatis oleh kamus istilah kami pada deskripsi ini — kunjungi halaman Glosarium " +
      "untuk memahami istilah-istilah keamanan siber secara umum."
    );
  }

  const explained = matches
    .slice(0, 5)
    .map((m) => `${m.term} (${m.id}${m.description ? ` — ${m.description}` : ""})`)
    .join("; ");

  return (
    `Deskripsi resmi (Bahasa Inggris) di atas menyebut istilah berikut: ${explained}. ` +
    "Untuk penjelasan istilah keamanan siber lainnya, kunjungi halaman Glosarium."
  );
}

// ---------------------------------------------------------------------------
// CVSS — prefer v4.0, then v3.1, then v3.0, then v2; never assume one exists
// ---------------------------------------------------------------------------

function pickPrimary<T extends { type?: string }>(list?: T[]): T | undefined {
  if (!list || list.length === 0) return undefined;
  return list.find((m) => m.type === "Primary") ?? list[0];
}

function mapCvssV4(data: NvdCvssV40Data): CVSSMetrics {
  const attackVector = data.attackVector === "ADJACENT" ? "ADJACENT_NETWORK" : data.attackVector;
  return {
    version: "4.0",
    baseScore: data.baseScore,
    severity: data.baseSeverity,
    vectorString: data.vectorString,
    attackVector,
    attackComplexity: data.attackComplexity,
    attackRequirements: data.attackRequirements ?? "NONE",
    privilegesRequired: data.privilegesRequired,
    userInteraction: data.userInteraction,
    scope: "NOT_DEFINED",
    confidentialityImpact: data.vulnerableSystemConfidentiality,
    integrityImpact: data.vulnerableSystemIntegrity,
    availabilityImpact: data.vulnerableSystemAvailability,
    vulnerableSystemImpact: {
      confidentiality: data.vulnerableSystemConfidentiality,
      integrity: data.vulnerableSystemIntegrity,
      availability: data.vulnerableSystemAvailability,
    },
    subsequentSystemImpact: {
      confidentiality: data.subsequentSystemConfidentiality,
      integrity: data.subsequentSystemIntegrity,
      availability: data.subsequentSystemAvailability,
    },
  };
}

function mapCvssV3(data: NvdCvssV3Data): CVSSMetrics {
  return {
    version: data.version,
    baseScore: data.baseScore,
    severity: data.baseSeverity,
    vectorString: data.vectorString,
    attackVector: data.attackVector,
    attackComplexity: data.attackComplexity,
    privilegesRequired: data.privilegesRequired,
    userInteraction: data.userInteraction,
    scope: data.scope,
    confidentialityImpact: data.confidentialityImpact,
    integrityImpact: data.integrityImpact,
    availabilityImpact: data.availabilityImpact,
  };
}

/** Best-effort parse of a CVSS v2 vector string (e.g. "AV:N/AC:L/Au:N/C:C/I:C/A:C") for the sub-metrics the v2 schema doesn't expose directly. */
function parseV2Vector(vectorString: string | undefined): Record<string, string> {
  const parts: Record<string, string> = {};
  if (!vectorString) return parts;
  for (const segment of vectorString.split("/")) {
    const [key, value] = segment.split(":");
    if (key && value) parts[key] = value;
  }
  return parts;
}

/**
 * CVSS v2 has no `privilegesRequired`, `userInteraction`, or `scope`
 * concept, and its severity bands are only LOW/MEDIUM/HIGH (no CRITICAL/
 * NONE). This is a documented approximation onto the v3-shaped internal
 * model, not a precise translation — `version: "2.0"` is preserved on the
 * result so the UI's "Skor CVSS {version}" heading tells the reader which
 * scoring generation they're actually looking at.
 */
function mapCvssV2(data: NvdCvssV2Data, baseSeverity?: "LOW" | "MEDIUM" | "HIGH"): CVSSMetrics {
  const v = parseV2Vector(data.vectorString);
  const impact = (code: string | undefined): "NONE" | "LOW" | "HIGH" =>
    code === "C" ? "HIGH" : code === "P" ? "LOW" : "NONE";

  return {
    version: "2.0",
    baseScore: data.baseScore,
    severity: baseSeverity ?? (data.baseScore >= 7 ? "HIGH" : data.baseScore >= 4 ? "MEDIUM" : "LOW"),
    vectorString: data.vectorString,
    attackVector: v.AV === "L" ? "LOCAL" : v.AV === "A" ? "ADJACENT_NETWORK" : "NETWORK",
    attackComplexity: v.AC === "L" ? "LOW" : "HIGH",
    // v2's "Authentication" isn't quite "privileges required", but it's the closest available analog.
    privilegesRequired: v.Au === "N" ? "NONE" : v.Au === "S" ? "LOW" : "HIGH",
    userInteraction: "NONE", // v2 has no such dimension — defaulting rather than guessing REQUIRED.
    scope: "UNCHANGED", // v2 has no such dimension.
    confidentialityImpact: impact(v.C),
    integrityImpact: impact(v.I),
    availabilityImpact: impact(v.A),
  };
}

/** Used only when NVD hasn't published any CVSS score yet (e.g. "Awaiting Analysis"). */
function unscoredCvss(): CVSSMetrics {
  return {
    version: "3.1",
    baseScore: 0,
    severity: "NONE",
    vectorString: "Belum dinilai oleh NVD",
    attackVector: "NETWORK",
    attackComplexity: "HIGH",
    privilegesRequired: "HIGH",
    userInteraction: "REQUIRED",
    scope: "UNCHANGED",
    confidentialityImpact: "NONE",
    integrityImpact: "NONE",
    availabilityImpact: "NONE",
  };
}

function selectCvss(metrics: NvdCveRecord["metrics"]): CVSSMetrics {
  const v40 = pickPrimary(metrics?.cvssMetricV40);
  if (v40) return mapCvssV4(v40.cvssData);

  const v31 = pickPrimary(metrics?.cvssMetricV31);
  if (v31) return mapCvssV3(v31.cvssData);

  const v30 = pickPrimary(metrics?.cvssMetricV30);
  if (v30) return mapCvssV3(v30.cvssData);

  const v2 = pickPrimary(metrics?.cvssMetricV2);
  if (v2) return mapCvssV2(v2.cvssData, v2.baseSeverity);

  return unscoredCvss();
}

// ---------------------------------------------------------------------------
// CWE
// ---------------------------------------------------------------------------

function extractCwe(weaknesses: NvdWeakness[] | undefined): CWEReference[] {
  if (!weaknesses) return [];
  const ids = new Set<string>();
  for (const weakness of weaknesses) {
    for (const desc of weakness.description) {
      if (desc.lang === "en" && /^(CWE-\d+|NVD-CWE-.+)$/.test(desc.value)) {
        ids.add(desc.value);
      }
    }
  }
  return [...ids].map((id) => ({ id, name: getCweName(id) }));
}

// ---------------------------------------------------------------------------
// CPE parsing → vendor / product / affected versions
// ---------------------------------------------------------------------------

interface ParsedCpe {
  part: string; // "a" application, "o" operating system, "h" hardware
  vendor: string;
  product: string;
  version: string;
}

/** Splits a CPE 2.3 string on unescaped colons and un-escapes the rest — a pragmatic parser, not a full CPE grammar implementation. */
function parseCpe(criteria: string): ParsedCpe | null {
  const segments = criteria.split(/(?<!\\):/).map((s) => s.replace(/\\(.)/g, "$1"));
  // cpe : 2.3 : part : vendor : product : version : ...
  if (segments.length < 6 || segments[0] !== "cpe") return null;
  const [, , part = "", vendor, product, version = ""] = segments;
  if (!vendor || !product) return null;
  return { part, vendor, product, version };
}

const ACRONYMS = new Set(["ibm", "sap", "f5", "sql", "xml", "html", "php", "aws", "gcp", "api", "url", "ssl", "tls", "ssh"]);

function prettifyCpeComponent(raw: string): string {
  if (raw === "*" || raw === "-") return "";
  return raw
    .split(/[_\-.]+/)
    .filter(Boolean)
    .map((word) => (ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

function describeVersionRange(match: NvdCpeMatch, singleVersion: string): string | undefined {
  const bounds: string[] = [];
  if (match.versionStartIncluding) bounds.push(`>= ${match.versionStartIncluding}`);
  if (match.versionStartExcluding) bounds.push(`> ${match.versionStartExcluding}`);
  if (match.versionEndIncluding) bounds.push(`<= ${match.versionEndIncluding}`);
  if (match.versionEndExcluding) bounds.push(`< ${match.versionEndExcluding}`);
  if (bounds.length > 0) return bounds.join(", ");
  if (singleVersion && singleVersion !== "*" && singleVersion !== "-") return singleVersion;
  return undefined;
}

function extractAffectedProducts(configurations: NvdConfiguration[]): AffectedProduct[] {
  const byKey = new Map<string, AffectedProduct>();

  for (const config of configurations) {
    for (const node of config.nodes) {
      for (const match of node.cpeMatch) {
        if (!match.vulnerable) continue; // "platform" entries (e.g. the OS a library merely runs on) aren't the affected product itself
        const parsed = parseCpe(match.criteria);
        if (!parsed) continue;

        const vendor = prettifyCpeComponent(parsed.vendor) || "Unknown Vendor";
        const product = prettifyCpeComponent(parsed.product) || "Unknown Product";
        const key = `${vendor}::${product}`;
        const versionLabel = describeVersionRange(match, parsed.version);

        const existing = byKey.get(key);
        if (existing) {
          if (versionLabel && !existing.versions.includes(versionLabel)) existing.versions.push(versionLabel);
        } else {
          byKey.set(key, { vendor, product, versions: versionLabel ? [versionLabel] : [] });
        }
      }
    }
  }

  return [...byKey.values()];
}

// ---------------------------------------------------------------------------
// Category — NVD has no such taxonomy, so this is a documented best-effort
// heuristic based on CPE `part` and a handful of CWE/keyword signals. It's
// intentionally simple rather than an exhaustive classifier.
// ---------------------------------------------------------------------------

const WEB_APP_CWES = new Set(["CWE-79", "CWE-89", "CWE-352", "CWE-434", "CWE-98", "CWE-601", "CWE-611", "CWE-918"]);
const CLOUD_KEYWORDS = /\b(aws|amazon web services|azure|google cloud|gcp|kubernetes|docker|cloud)\b/i;

function inferCategory(configurations: NvdConfiguration[], cwe: CWEReference[], descriptionEn: string): CVECategory {
  const parts = new Set<string>();
  for (const config of configurations) {
    for (const node of config.nodes) {
      for (const match of node.cpeMatch) {
        if (!match.vulnerable) continue; // a non-vulnerable "runs on Windows"-style platform entry shouldn't drive classification
        const parsed = parseCpe(match.criteria);
        if (parsed) parts.add(parsed.part);
      }
    }
  }

  if (parts.has("o")) return "operating-system";
  if (cwe.some((w) => WEB_APP_CWES.has(w.id))) return "web-application";
  if (CLOUD_KEYWORDS.test(descriptionEn)) return "cloud-infrastructure";
  if (parts.has("h")) return "network";
  return "enterprise-software";
}

// ---------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Referensi";
  }
}

function extractReferences(references: NvdCveRecord["references"]): CVEReference[] {
  if (!references) return [];
  return references.map((ref) => ({
    url: ref.url,
    source: ref.source || safeHostname(ref.url),
    tags: ref.tags,
  }));
}

// ---------------------------------------------------------------------------
// Year — parsed from the ID itself (more reliable than the published date,
// which can theoretically differ from the ID's reservation year).
// ---------------------------------------------------------------------------

function extractYear(id: string): number {
  const match = id.match(/^CVE-(\d{4})-/);
  return match ? Number(match[1]) : new Date().getFullYear();
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function normalizeNvdCve(raw: NvdCveRecord): CVE {
  const descriptionEn = pickEnglishDescription(raw.descriptions);
  const cwe = extractCwe(raw.weaknesses);
  const affected = extractAffectedProducts(raw.configurations ?? []);
  const primary = affected[0];

  return {
    id: raw.id,
    title: deriveTitle(descriptionEn),
    year: extractYear(raw.id),
    publishedDate: raw.published,
    lastModifiedDate: raw.lastModified,
    descriptionEn,
    descriptionId: buildIndonesianAssist(descriptionEn),
    cvss: selectCvss(raw.metrics),
    cwe,
    vendor: primary?.vendor ?? "Unknown Vendor",
    product: primary?.product ?? "Unknown Product",
    affected,
    references: extractReferences(raw.references),
    category: inferCategory(raw.configurations ?? [], cwe, descriptionEn),
  };
}
