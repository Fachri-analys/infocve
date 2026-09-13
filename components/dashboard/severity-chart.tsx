import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumberId } from "@/utils/format";
import type { SeverityCount, ScoreBracket } from "@/lib/dashboard-stats";

interface SeverityChartProps {
  severityDistribution: SeverityCount[];
  brackets: ScoreBracket[];
  totalCves: number;
}

export function SeverityChart({ severityDistribution, brackets, totalCves }: SeverityChartProps) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Distribusi Tingkat Keparahan (CVSS Severity)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Proporsi tingkat keparahan berdasarkan metriks standar CVSS dari {formatNumberId(totalCves)} sampel kerentanan
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-2">
        {/* Horizontal Stacked Bar */}
        <div>
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
            {severityDistribution.map((item) => {
              if (item.percentage <= 0) return null;
              return (
                <div
                  key={item.severity}
                  className={`${item.bgClass} transition-all`}
                  style={{ width: `${item.percentage}%` }}
                  title={`${item.labelId}: ${item.count} (${item.percentage}%)`}
                />
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {severityDistribution.map((item) => (
              <div key={item.severity} className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${item.bgClass}`} />
                  <span className="text-xs font-medium text-foreground">{item.labelId}</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-mono text-lg font-semibold text-foreground">
                    {formatNumberId(item.count)}
                  </span>
                  <span className="text-xs text-muted-foreground">({item.percentage}%)</span>
                </div>
                {item.severity !== "UNKNOWN" && (
                  <Link
                    href={`/search?severity=${item.severity}`}
                    className="mt-1 text-[11px] text-accent underline-offset-2 hover:underline"
                  >
                    Lihat daftar
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CVSS Score Brackets breakdown */}
        <div className="border-t border-border pt-4">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Distribusi Rentang Skor Numerik CVSS
          </h4>
          <div className="mt-3 space-y-2.5">
            {brackets.map((bracket) => (
              <div key={bracket.range} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-mono font-medium text-foreground">
                    {bracket.range} <span className="text-muted-foreground font-sans font-normal">({bracket.label})</span>
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {formatNumberId(bracket.count)} ({bracket.percentage}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${bracket.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
