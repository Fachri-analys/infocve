export type ScanStatus = "COMPLETED" | "COMPLETED_WITH_WARNINGS" | "INCOMPLETE" | "FAILED";
export type VerificationStatus = "RESOLVED" | "STILL_DETECTED" | "UNVERIFIED";
export type MatchStatus = "CONFIRMED" | "NEEDS_REVIEW" | "UNVERIFIED";
export type SourceObservationType = "ADVISORY_RESPONSE" | "LOCAL_SNAPSHOT" | "REFERENCE_ONLY" | "SOURCE_NOT_QUERIED" | "SOURCE_LOOKUP_NO_RECORD";
export type RightsReviewStatus = "TERMS_IDENTIFIED" | "NEEDS_REVIEW";

export interface SourceEvidence {
  source: "OSV" | "GITHUB_SECURITY_ADVISORIES" | "NVD" | "VENDOR_ADVISORY";
  advisoryId: string | null;
  url: string | null;
  originUrl?: string | null;
  fetchedAt: string;
  updatedAt?: string | null;
  packageName?: string | null;
  ecosystem?: string | null;
  purl?: string | null;
  affectedRanges: string[];
  evaluation: "AFFECTED" | "NOT_AFFECTED" | "UNKNOWN" | "IDENTITY_MISMATCH" | "NOT_COMPARABLE";
  reason: string;
  rightsReviewStatus?: RightsReviewStatus;
  dataRightsNote?: string;
  dataRightsUrl?: string | null;
  observationType?: SourceObservationType;
}

/** Safe, allow-listed fields for both the persisted per-scan audit trail and JSON logs. */
export interface ScanAuditEvent {
  scan_id: string;
  timestamp: string;
  stage: string;
  status: string;
  package?: string;
  version?: string;
  cve?: string;
  affected_range?: string;
  source?: string;
  decision?: string;
  reason?: string;
  retry?: number;
  api_error?: string;
  duration_ms?: number;
}

export interface ScanWarning {
  code: string;
  message: string;
  packageName?: string;
  cveId?: string;
}

export interface ScanPackage {
  name: string;
  version: string;
  purl?: string;
  direct: boolean;
  transitive: boolean;
  locations: string[];
}

export interface ScanReference {
  type: string;
  url: string;
}

export interface ReportSourceAttribution {
  sourceId: SourceEvidence["source"];
  sourceName: string;
  sourceUrl: string;
  termsUrl: string | null;
  additionalTermsUrl?: string | null;
  rightsNote: string;
  rightsReviewStatus?: RightsReviewStatus;
}

export interface DependencyFinding {
  key: string;
  cveId: string;
  osvIds: string[];
  packageName: string;
  version: string;
  direct: boolean;
  transitive: boolean;
  locations: string[];
  priority: "P1" | "P2" | "P3" | "P4";
  prioritySource: string;
  priorityReasons: string[];
  severity: string | null;
  summary: string | null;
  advisoryDetails: string | null;
  affectedRanges: string[];
  fixedVersions: string[];
  upgradeCommand: string | null;
  temporaryMitigation: string | null;
  references: ScanReference[];
  advisoryReferences: ScanReference[];
  sourceConflicts: string[];
  matchStatus: MatchStatus;
  sourceEvidence: SourceEvidence[];
  verificationStatus: VerificationStatus;
  previousVersion?: string;
  currentDetected: boolean;
}

export interface DependencyScanReport {
  scanId: string;
  parentScanId: string | null;
  scannedAt: string;
  status: ScanStatus;
  scope: {
    ecosystem: "npm";
    projectName: string | null;
    lockfileVersion: number;
    packageCount: number;
    directCount: number;
    transitiveCount: number;
    dataSources: string[];
  };
  packages: ScanPackage[];
  findings: DependencyFinding[];
  warnings: ScanWarning[];
  limitations: string[];
  auditTrail: ScanAuditEvent[];
  sourceAttributions?: ReportSourceAttribution[];
}
