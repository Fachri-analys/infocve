/**
 * Raw NVD REST API v2.0 response shapes.
 *
 * These mirror https://nvd.nist.gov/developers/vulnerabilities exactly and
 * exist ONLY so `lib/nvd-normalize.ts` has something precise to map from.
 * Nothing outside `lib/nvd-*.ts` should ever import these — the rest of the
 * app only ever sees the internal `CVE` model from `types/cve.ts`. That
 * boundary is what lets NVD change its response shape without every page
 * and component needing to change too.
 */

export interface NvdLangValue {
  lang: string;
  value: string;
}

export interface NvdCvssV3Data {
  version: "3.0" | "3.1";
  vectorString: string;
  attackVector: "NETWORK" | "ADJACENT_NETWORK" | "LOCAL" | "PHYSICAL";
  attackComplexity: "LOW" | "HIGH";
  privilegesRequired: "NONE" | "LOW" | "HIGH";
  userInteraction: "NONE" | "REQUIRED";
  scope: "UNCHANGED" | "CHANGED";
  confidentialityImpact: "NONE" | "LOW" | "HIGH";
  integrityImpact: "NONE" | "LOW" | "HIGH";
  availabilityImpact: "NONE" | "LOW" | "HIGH";
  baseScore: number;
  baseSeverity: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface NvdCvssMetricV3 {
  source?: string;
  type?: "Primary" | "Secondary";
  cvssData: NvdCvssV3Data;
  exploitabilityScore?: number;
  impactScore?: number;
}

export interface NvdCvssV2Data {
  version: "2.0";
  vectorString: string;
  baseScore: number;
}

export interface NvdCvssMetricV2 {
  source?: string;
  type?: "Primary" | "Secondary";
  cvssData: NvdCvssV2Data;
  baseSeverity?: "LOW" | "MEDIUM" | "HIGH";
}

export interface NvdCvssV40Data {
  version: "4.0";
  vectorString: string;
  baseScore: number;
  baseSeverity: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  attackVector: "NETWORK" | "ADJACENT" | "LOCAL" | "PHYSICAL";
  attackComplexity: "HIGH" | "LOW";
  attackRequirements?: "NONE" | "PRESENT";
  privilegesRequired: "NONE" | "LOW" | "HIGH";
  userInteraction: "NONE" | "PASSIVE" | "ACTIVE";
  vulnerableSystemConfidentiality: "NONE" | "LOW" | "HIGH";
  vulnerableSystemIntegrity: "NONE" | "LOW" | "HIGH";
  vulnerableSystemAvailability: "NONE" | "LOW" | "HIGH";
  subsequentSystemConfidentiality: "NONE" | "LOW" | "HIGH";
  subsequentSystemIntegrity: "NONE" | "LOW" | "HIGH";
  subsequentSystemAvailability: "NONE" | "LOW" | "HIGH";
  safety?: "NOT_DEFINED" | "NEGLIGIBLE" | "MARGINAL" | "MODERATE" | "MAJOR" | "CATASTROPHIC";
  automatable?: "NOT_DEFINED" | "NO" | "YES";
  recovery?: "NOT_DEFINED" | "AUTOMATIC" | "USER" | "IRRECOVERABLE";
  valueDensity?: "NOT_DEFINED" | "DIFFUSE" | "CONCENTRATED";
  vulnerabilityResponseEffort?: "NOT_DEFINED" | "LOW" | "MODERATE" | "HIGH";
  providerUrgency?: "NOT_DEFINED" | "CLEAR" | "GREEN" | "AMBER" | "RED";
}

export interface NvdCvssMetricV40 {
  source?: string;
  type?: "Primary" | "Secondary";
  cvssData: NvdCvssV40Data;
}

export interface NvdWeakness {
  source?: string;
  type?: string;
  description: NvdLangValue[];
}

export interface NvdCpeMatch {
  vulnerable: boolean;
  criteria: string;
  matchCriteriaId?: string;
  versionStartIncluding?: string;
  versionStartExcluding?: string;
  versionEndIncluding?: string;
  versionEndExcluding?: string;
}

export interface NvdConfigurationNode {
  operator?: "AND" | "OR";
  negate?: boolean;
  cpeMatch: NvdCpeMatch[];
}

export interface NvdConfiguration {
  nodes: NvdConfigurationNode[];
}

export interface NvdReference {
  url: string;
  source?: string;
  tags?: string[];
}

export type NvdVulnStatus =
  | "Analyzed"
  | "Awaiting Analysis"
  | "Undergoing Analysis"
  | "Modified"
  | "Deferred"
  | "Rejected"
  | "Received";

export interface NvdCveRecord {
  id: string;
  sourceIdentifier?: string;
  published: string;
  lastModified: string;
  vulnStatus?: NvdVulnStatus;
  descriptions: NvdLangValue[];
  metrics?: {
    cvssMetricV40?: NvdCvssMetricV40[];
    cvssMetricV31?: NvdCvssMetricV3[];
    cvssMetricV30?: NvdCvssMetricV3[];
    cvssMetricV2?: NvdCvssMetricV2[];
  };
  weaknesses?: NvdWeakness[];
  configurations?: NvdConfiguration[];
  references?: NvdReference[];
}

export interface NvdVulnerabilityWrapper {
  cve: NvdCveRecord;
}

/** The shape of a successful `GET /rest/json/cves/2.0` response. */
export interface NvdCveApiResponse {
  resultsPerPage: number;
  startIndex: number;
  totalResults: number;
  format?: string;
  version?: string;
  timestamp?: string;
  vulnerabilities: NvdVulnerabilityWrapper[];
}

/** The shape NVD returns on 4xx/5xx errors (just a message, per their OpenAPI spec). */
export interface NvdErrorResponse {
  message?: string;
}

/** Native query parameters this app actually sends — a deliberate subset of what the API supports. */
export interface NvdQueryParams {
  cveId?: string;
  keywordSearch?: string;
  cvssV3Severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  cweId?: string;
  pubStartDate?: string;
  pubEndDate?: string;
  lastModStartDate?: string;
  lastModEndDate?: string;
  resultsPerPage?: number;
  startIndex?: number;
}
