import { Activity, ExternalLink, Info } from "lucide-react";
import type { EPSSScore } from "@/types/cve";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDateId } from "@/utils/format";

export function EPSSCard({ epss }: { epss?: EPSSScore }) {
  if (!epss || epss.score === undefined || epss.score === null || isNaN(epss.score)) {
    return (
      <Card className="border-border/80 bg-surface-hover/20">
        <CardContent className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
          <Activity className="size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">Data EPSS Belum Tersedia</p>
            <p className="text-xs">
              Skor probabilitas eksploitasi dari FIRST.org belum tersedia atau belum dipublikasikan untuk CVE ini.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const percentile = typeof epss.percentile === "number" && !isNaN(epss.percentile) ? epss.percentile : 0;
  const scorePct = (epss.score * 100).toFixed(2);
  const percentilePct = (percentile * 100).toFixed(1);

  // Risk categorization based on EPSS percentiles and score thresholds
  let riskLabel = "Rendah";
  let riskColor = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
  if (percentile >= 0.95 || epss.score >= 0.3) {
    riskLabel = "Sangat Tinggi";
    riskColor = "text-red-500 bg-red-500/10 border-red-500/20";
  } else if (percentile >= 0.8 || epss.score >= 0.1) {
    riskLabel = "Tinggi";
    riskColor = "text-amber-500 bg-amber-500/10 border-amber-500/20";
  } else if (percentile >= 0.5) {
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
          <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", riskColor)}>
            Tingkat Risiko: {riskLabel}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 border-y border-border">
          <div className="py-3 pr-3">
            <p className="text-xs text-muted-foreground">Probabilitas Eksploitasi (30 Hari)</p>
            <p className="data-tag mt-1 text-2xl font-bold text-foreground">{scorePct}%</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Nilai mentah: {epss.score.toFixed(5)}</p>
          </div>

          <div className="border-l border-border py-3 pl-3">
            <p className="text-xs text-muted-foreground">Persentil Global</p>
            <p className="data-tag mt-1 text-2xl font-bold text-foreground">{percentilePct}%</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Lebih berisiko dari {percentilePct}% kerentanan CVE lainnya</p>
          </div>
        </div>

        {/* Progress bar visual */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Posisi Persentil Prediksi</span>
            <span>{percentilePct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(2, percentile * 100))}%` }}
            />
          </div>
        </div>

        {epss.date && (
          <p className="text-[11px] text-muted-foreground">
            Tanggal perhitungan model: <strong>{formatDateId(epss.date)}</strong>
          </p>
        )}

        <div className="flex items-start gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-accent" />
          <div className="space-y-1">
            <p>
              EPSS (Exploit Prediction Scoring System) mengestimasi probabilitas bahwa kerentanan perangkat lunak ini akan dieksploitasi di dunia nyata dalam 30 hari ke depan.
            </p>
            <a
              href="https://www.first.org/epss/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
            >
              Atribusi & Dokumentasi FIRST.org EPSS
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
