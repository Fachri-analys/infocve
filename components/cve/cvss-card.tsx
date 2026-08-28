import { Gauge } from "lucide-react";

import type { CVSSMetrics } from "@/types/cve";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/cve/severity-badge";
import { formatCvssScore } from "@/utils/format";
import {
  attackComplexityLabel,
  attackRequirementsLabel,
  attackVectorLabel,
  cvssMetricInfo,
  impactLabel,
  privilegesRequiredLabel,
  scopeLabel,
  userInteractionLabel,
} from "@/lib/cvss-explanations";
import { cn } from "@/lib/utils";

function MetricRow({ label, value, explanation }: { label: string; value: string; explanation: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/70 py-3 last:border-none sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-sm font-medium text-foreground sm:w-48 sm:shrink-0">{label}</span>
      <div className="sm:flex-1">
        <span className="data-tag text-sm text-accent">{value}</span>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{explanation}</p>
      </div>
    </div>
  );
}

/** Score gauge: a 5-segment bar echoing the severity scale, doubling as this app's visual signature for "measurement". */
function ScoreMeter({ score }: { score: number }) {
  const filled = score <= 0 ? 0 : Math.max(1, Math.round((score / 10) * 5));
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-6 rounded-full transition-colors",
            i < filled ? "bg-accent" : "bg-surface-hover"
          )}
        />
      ))}
    </div>
  );
}

export function CVSSCard({ cvss }: { cvss: CVSSMetrics }) {
  const isV4 = cvss.version === "4.0";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Gauge className="size-4 text-accent" />
            Skor CVSS {cvss.version}
          </CardTitle>
          <SeverityBadge severity={cvss.severity} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-hover/50 px-4 py-3">
          <div>
            <p className="data-tag text-2xl font-medium text-foreground">{formatCvssScore(cvss.baseScore)}</p>
            <p className="text-xs text-muted-foreground">dari skala 0.0 – 10.0</p>
          </div>
          <ScoreMeter score={cvss.baseScore} />
        </div>

        <p className="data-tag rounded-lg border border-border bg-surface-hover/30 px-3 py-2 text-xs text-muted-foreground break-all">
          {cvss.vectorString}
        </p>

        <div className="pt-1">
          <MetricRow label="Attack Vector" value={attackVectorLabel[cvss.attackVector].label} explanation={attackVectorLabel[cvss.attackVector].explanation} />
          <MetricRow label="Attack Complexity" value={attackComplexityLabel[cvss.attackComplexity].label} explanation={attackComplexityLabel[cvss.attackComplexity].explanation} />
          {isV4 && cvss.attackRequirements && (
            <MetricRow
              label="Attack Requirements"
              value={attackRequirementsLabel[cvss.attackRequirements].label}
              explanation={attackRequirementsLabel[cvss.attackRequirements].explanation}
            />
          )}
          <MetricRow label="Privileges Required" value={privilegesRequiredLabel[cvss.privilegesRequired].label} explanation={privilegesRequiredLabel[cvss.privilegesRequired].explanation} />
          <MetricRow label="User Interaction" value={userInteractionLabel[cvss.userInteraction].label} explanation={userInteractionLabel[cvss.userInteraction].explanation} />
          {!isV4 && (
            <MetricRow label="Scope" value={scopeLabel[cvss.scope].label} explanation={scopeLabel[cvss.scope].explanation} />
          )}

          {isV4 && cvss.vulnerableSystemImpact ? (
            <>
              <div className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-accent">
                Vulnerable System Impact (Sistem Rentan Utama)
              </div>
              <MetricRow
                label="Confidentiality (VC)"
                value={impactLabel[cvss.vulnerableSystemImpact.confidentiality].label}
                explanation="Dampak kerahasiaan pada sistem rentan utama."
              />
              <MetricRow
                label="Integrity (VI)"
                value={impactLabel[cvss.vulnerableSystemImpact.integrity].label}
                explanation="Dampak integritas pada sistem rentan utama."
              />
              <MetricRow
                label="Availability (VA)"
                value={impactLabel[cvss.vulnerableSystemImpact.availability].label}
                explanation="Dampak ketersediaan pada sistem rentan utama."
              />
            </>
          ) : null}

          {isV4 && cvss.subsequentSystemImpact ? (
            <>
              <div className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-accent">
                Subsequent System Impact (Sistem Lanjutan)
              </div>
              <MetricRow
                label="Confidentiality (SC)"
                value={impactLabel[cvss.subsequentSystemImpact.confidentiality].label}
                explanation="Dampak kerahasiaan pada sistem sekunder/lanjutan."
              />
              <MetricRow
                label="Integrity (SI)"
                value={impactLabel[cvss.subsequentSystemImpact.integrity].label}
                explanation="Dampak integritas pada sistem sekunder/lanjutan."
              />
              <MetricRow
                label="Availability (SA)"
                value={impactLabel[cvss.subsequentSystemImpact.availability].label}
                explanation="Dampak ketersediaan pada sistem sekunder/lanjutan."
              />
            </>
          ) : null}

          {!isV4 && (
            <>
              <MetricRow
                label={cvssMetricInfo.confidentiality.label}
                value={impactLabel[cvss.confidentialityImpact].label}
                explanation={cvssMetricInfo.confidentiality.description}
              />
              <MetricRow
                label={cvssMetricInfo.integrity.label}
                value={impactLabel[cvss.integrityImpact].label}
                explanation={cvssMetricInfo.integrity.description}
              />
              <MetricRow
                label={cvssMetricInfo.availability.label}
                value={impactLabel[cvss.availabilityImpact].label}
                explanation={cvssMetricInfo.availability.description}
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
