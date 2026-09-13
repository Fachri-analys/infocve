import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumberId } from "@/utils/format";
import type { PriorityTierCount } from "@/lib/dashboard-stats";
import { ShieldAlert, AlertTriangle, Clock, CheckCircle, Info } from "lucide-react";

interface PriorityBreakdownProps {
  priorityStats: PriorityTierCount[];
}

const TIER_ICONS = {
  P1: ShieldAlert,
  P2: AlertTriangle,
  P3: Clock,
  P4: CheckCircle,
};

export function PriorityBreakdown({ priorityStats }: PriorityBreakdownProps) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Distribusi InfoCVE Priority (Rekomendasi Tindakan)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Klasifikasi prioritas aksi terpadu dari integrasi metrik CVSS, CISA KEV, EPSS, dan PoC exploit
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {priorityStats.map((item) => {
            const Icon = TIER_ICONS[item.tier];
            return (
              <div
                key={item.tier}
                className="flex flex-col justify-between rounded-lg border border-border bg-background-raised/30 p-4 transition-colors hover:border-foreground/20"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold tracking-tight text-foreground">
                      {item.tier}
                    </span>
                    <Icon className={`size-4 ${item.colorClass}`} />
                  </div>
                  <h4 className={`mt-1 text-sm font-semibold ${item.colorClass}`}>{item.labelId}</h4>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="font-mono text-2xl font-bold text-foreground">
                      {formatNumberId(item.count)}
                    </span>
                    <span className="text-xs text-muted-foreground">({item.percentage}%)</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.actionGuidance}</p>
                </div>

                <div className="mt-4 pt-2 border-t border-border/60">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${item.bgClass}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <Info className="size-4 shrink-0 text-muted-foreground" />
          <span>
            <strong>Catatan:</strong> InfoCVE Priority merupakan metodologi penilaian berbasis heuristik internal InfoCVE untuk membantu
            triage kerentanan, bukan standar resmi pengganti kepatuhan regulasi institusi.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
