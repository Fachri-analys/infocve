import { Activity, Info } from "lucide-react";
import type { EPSSScore } from "@/types/cve";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function EPSSCard({ epss }: { epss?: EPSSScore }) {
  if (!epss || epss.score === undefined) return null;

  const scorePct = (epss.score * 100).toFixed(2);
  const percentilePct = (epss.percentile * 100).toFixed(1);

  // Risk categorization based on EPSS percentiles
  let riskLabel = "Rendah";
  let riskColor = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
  if (epss.percentile >= 0.95 || epss.score >= 0.3) {
    riskLabel = "Sangat Tinggi";
    riskColor = "text-red-500 bg-red-500/10 border-red-500/20";
  } else if (epss.percentile >= 0.8 || epss.score >= 0.1) {
    riskLabel = "Tinggi";
    riskColor = "text-amber-500 bg-amber-500/10 border-amber-500/20";
  } else if (epss.percentile >= 0.5) {
    riskLabel = "Menengah";
    riskColor = "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4 text-accent" />
            Skor EPSS (Prediksi Eksploitasi)
          </CardTitle>
          <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", riskColor)}>
            {riskLabel}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-surface-hover/40 p-3">
            <p className="text-xs text-muted-foreground">Probabilitas Eksploitasi (30 Hari)</p>
            <p className="data-tag mt-1 text-2xl font-bold text-foreground">{scorePct}%</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Skor: {epss.score.toFixed(4)}</p>
          </div>

          <div className="rounded-xl border border-border bg-surface-hover/40 p-3">
            <p className="text-xs text-muted-foreground">Persentil Global</p>
            <p className="data-tag mt-1 text-2xl font-bold text-foreground">{percentilePct}%</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Lebih berisiko dari {percentilePct}% CVE lain</p>
          </div>
        </div>

        {/* Progress bar visual */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Tingkat Keparahan Prediksi</span>
            <span>{percentilePct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(2, epss.percentile * 100))}%` }}
            />
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-surface-hover/20 p-2.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-accent" />
          <p>
            Disediakan oleh FIRST.org. EPSS mengestimasi probabilitas bahwa kerentanan ini akan dieksploitasi di alam liar dalam 30 hari ke depan.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
