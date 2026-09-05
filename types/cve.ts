/**
 * Domain types for InfoCVE.
 *
 * These types describe the shape of vulnerability data independent of
 * where it comes from — the "internal model" side of the anti-corruption
 * layer at `lib/nvd-normalize.ts`, which maps the NVD API v2.0's actual
 * response shape (`lib/nvd-types.ts`) onto exactly this shape. Every value
 * conforming to `CVE` is produced by `lib/nvd.ts` from a live NVD API
 * response — see `docs/API_INTEGRATION.md` for how that mapping works and
 * what it can't derive directly from NVD (title, category).
 */

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";

export type AttackVector = "NETWORK" | "ADJACENT_NETWORK" | "LOCAL" | "PHYSICAL";
export type AttackComplexity = "LOW" | "HIGH";
export type PrivilegesRequired = "NONE" | "LOW" | "HIGH";
export type UserInteraction = "NONE" | "REQUIRED" | "PASSIVE" | "ACTIVE";
export type ScopeValue = "UNCHANGED" | "CHANGED" | "NOT_DEFINED";
export type ImpactValue = "NONE" | "LOW" | "HIGH";

export interface SystemImpact {
  confidentiality: ImpactValue;
  integrity: ImpactValue;
  availability: ImpactValue;
}

export interface CVSSMetrics {
  version: "4.0" | "3.1" | "3.0" | "2.0";
  baseScore: number;
  severity: Severity;
  vectorString: string;
  attackVector: AttackVector;
  attackComplexity: AttackComplexity;
  attackRequirements?: "NONE" | "PRESENT";
  privilegesRequired: PrivilegesRequired;
  userInteraction: UserInteraction;
  scope: ScopeValue;
  confidentialityImpact: ImpactValue;
  integrityImpact: ImpactValue;
  availabilityImpact: ImpactValue;
  vulnerableSystemImpact?: SystemImpact;
  subsequentSystemImpact?: SystemImpact;
}

export interface CWEReference {
  id: string; // e.g. "CWE-79"
  name: string;
}

export interface CVEReference {
  url: string;
  source: string;
  tags?: string[];
  isExploit?: boolean;
  isPoc?: boolean;
}

export interface AffectedProduct {
  vendor: string;
  product: string;
  versions: string[];
}

export type CVECategory =
  | "web-application"
  | "network"
  | "operating-system"
  | "framework-library"
  | "enterprise-software"
  | "cloud-infrastructure";

export interface EPSSScore {
  score: number; // 0.0 - 1.0 (e.g. 0.975 = 97.5% probability)
  percentile: number; // 0.0 - 1.0 (e.g. 0.999 = 99.9th percentile)
  date?: string;
}

export interface CisaKevStatus {
  isKev: boolean;
  dateAdded?: string;
  dueDate?: string;
  requiredAction?: string;
  notes?: string;
}

export type PriorityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface PriorityAssessment {
  level: PriorityLevel;
  tier: "P1" | "P2" | "P3" | "P4";
  labelId: string;
  reasons: string[];
  factors: {
    inCisaKev: boolean;
    cvssScore?: number;
    cvssSeverity?: Severity;
    epssScore?: number;
    epssPercentile?: number;
    hasPoc: boolean;
  };
  disclaimer: string;
}

export interface CVE {
  id: string; // "CVE-2021-44228"
  title: string;
  year: number;
  publishedDate: string; // ISO date
  lastModifiedDate: string; // ISO date
  descriptionEn: string;
  descriptionId: string;
  cvss: CVSSMetrics;
  cwe: CWEReference[];
  vendor: string;
  product: string;
  affected: AffectedProduct[];
  references: CVEReference[];
  category: CVECategory;
  epss?: EPSSScore;
  cisaKev?: CisaKevStatus;
  hasPoc?: boolean;
  priority?: PriorityAssessment;
  sources?: string[]; // e.g. ["NVD", "CISA_KEV", "EPSS", "GHSA"]
}

export interface PaginatedResult<T> {
  results: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SearchCVEParams {
  query?: string;
  severity?: Severity[];
  year?: number[];
  vendor?: string[];
  product?: string[];
  cwe?: string[];
  category?: CVECategory;
  cisaKevOnly?: boolean;
  hasPocOnly?: boolean;
  /** ISO date (yyyy-mm-dd) lower/upper bounds, inclusive. */
  publishedFrom?: string;
  publishedTo?: string;
  modifiedFrom?: string;
  modifiedTo?: string;
  sortBy?: "publishedDate" | "lastModifiedDate" | "baseScore";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}
