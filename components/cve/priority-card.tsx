import { AlertCircle, ArrowUpRight, CheckCircle2, Flame, ShieldAlert, Sparkles } from "lucide-react";
import type { PriorityAssessment } from "@/types/cve";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PriorityCard({ priority }: { priority?: PriorityAssessment }) {
  if (!priority) return null;

  let badgeColor = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
  let icon = <CheckCircle2 className="size-4 text-emerald-500" />;
  let cardBorder = "border-border";

  if (priority.level === "CRITICAL") {
    badgeColor = "text-red-500 bg-red-500/10 border-red-500/30";
    icon = <Flame className="size-4 text-red-500" />;
    cardBorder = "border-red-500/30 bg-red-500/5";
  } else if (priority.level === "HIGH") {
    badgeColor = "text-amber-500 bg-amber-500/10 border-amber-500/30";
    icon = <ShieldAlert className="size-4 text-amber-500" />;
    cardBorder = "border-amber-500/30 bg-amber-500/5";
  } else if (priority.level === "MEDIUM") {
    badgeColor = "text-yellow-500 bg-yellow-500/10 border-yellow-500/30";
    icon = <ArrowUpRight className="size-4 text-yellow-500" />;
    cardBorder = "border-yellow-500/20";
  }

  return (
    <Card className={cn("overflow-hidden", cardBorder)}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-accent" />
            InfoCVE Prioritas Remediasi (Triase)
          </CardTitle>
          <span className={cn("flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold", badgeColor)}>
            {icon}
            {priority.labelId}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Factor breakdown chips */}
        <div className="flex flex-wrap gap-2 text-xs">
          <div
            className={cn(
              "rounded-md border px-2 py-1 font-medium",
              priority.factors.inCisaKev
                ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                : "border-border bg-surface-hover/30 text-muted-foreground"
            )}
          >
            CISA KEV: {priority.factors.inCisaKev ? "Tercantum" : "Tidak"}
          </div>

          <div
            className={cn(
              "rounded-md border px-2 py-1 font-medium",
              priority.factors.epssScore !== undefined
                ? "border-accent/30 bg-accent/10 text-accent"
                : "border-border bg-surface-hover/30 text-muted-foreground"
            )}
          >
            EPSS:{" "}
            {priority.factors.epssScore !== undefined
              ? `${(priority.factors.epssScore * 100).toFixed(2)}%`
              : "Tidak tersedia"}
          </div>

          <div className="rounded-md border border-border bg-surface-hover/30 px-2 py-1 font-medium text-foreground">
            CVSS:{" "}
            {priority.factors.cvssScore !== undefined
              ? `${priority.factors.cvssScore.toFixed(1)} (${priority.factors.cvssSeverity || "N/A"})`
              : "Belum dinilai"}
          </div>

          <div
            className={cn(
              "rounded-md border px-2 py-1 font-medium",
              priority.factors.hasPoc
                ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-border bg-surface-hover/30 text-muted-foreground"
            )}
          >
            PoC / Eksploit: {priority.factors.hasPoc ? "Tersedia" : "Belum terdeteksi"}
          </div>
        </div>

        {/* Reasons list */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Alasan Penentuan Prioritas:
          </p>
          <ul className="space-y-1.5 text-xs text-foreground">
            {priority.reasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                <span className="leading-relaxed">{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <p className="leading-relaxed">{priority.disclaimer}</p>
        </div>
      </CardContent>
    </Card>
  );
}
