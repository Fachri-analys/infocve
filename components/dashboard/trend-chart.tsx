import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumberId } from "@/utils/format";
import type { TrendDataPoint } from "@/lib/dashboard-stats";
import { Calendar, TrendingUp } from "lucide-react";

interface TrendChartProps {
  trend: TrendDataPoint[];
}

export function TrendChart({ trend }: TrendChartProps) {
  if (trend.length === 0) {
    return null;
  }

  // Find max value to normalize bar heights
  const maxTotal = Math.max(...trend.map((t) => t.total), 1);

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-accent" />
            <CardTitle className="text-base font-semibold">Tren Publikasi Kerentanan (120 Hari Terakhir)</CardTitle>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-accent" />
              <span className="text-muted-foreground">Total Kerentanan</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-red-500" />
              <span className="text-muted-foreground">Kritis (CVSS &gt;= 9.0)</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Fluktuasi volume penemuan kerentanan mingguan yang dipublikasikan ke National Vulnerability Database.
        </p>
      </CardHeader>
      <CardContent className="pt-2">
        {/* Responsive Bar Chart */}
        <div className="mt-4 flex h-48 items-end gap-2 sm:gap-3 overflow-x-auto pb-6 pt-4">
          {trend.map((point) => {
            const totalHeightPercent = Math.max(Math.round((point.total / maxTotal) * 100), 4);
            const criticalHeightPercent = point.total > 0
              ? Math.max(Math.round((point.critical / point.total) * 100), 0)
              : 0;

            return (
              <div
                key={point.periodKey}
                className="group relative flex flex-1 min-w-[28px] max-w-[48px] flex-col items-center h-full justify-end"
              >
                {/* Tooltip on hover */}
                <div className="pointer-events-none absolute -top-12 z-20 hidden rounded border border-border bg-popover px-2 py-1 text-center text-[10px] shadow-md group-hover:block whitespace-nowrap">
                  <p className="font-semibold text-foreground">{point.label}</p>
                  <p className="text-muted-foreground">
                    Total: <span className="font-mono text-foreground">{point.total}</span> | Kritis:{" "}
                    <span className="font-mono text-red-500">{point.critical}</span>
                  </p>
                </div>

                {/* Stacked Vertical Bar */}
                <div
                  className="relative w-full rounded-t bg-accent/30 transition-all group-hover:bg-accent/50 overflow-hidden"
                  style={{ height: `${totalHeightPercent}%` }}
                >
                  {/* Critical portion at bottom */}
                  {point.critical > 0 && (
                    <div
                      className="absolute bottom-0 w-full bg-red-500 transition-all"
                      style={{ height: `${criticalHeightPercent}%` }}
                    />
                  )}
                </div>

                {/* X-axis Label */}
                <span className="absolute -bottom-5 text-[10px] font-mono text-muted-foreground truncate w-full text-center">
                  {point.label.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border pt-2">
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            Rentang: {trend[0]?.label} - {trend[trend.length - 1]?.label}
          </span>
          <span>Puncak: {formatNumberId(maxTotal)} kerentanan / pekan</span>
        </div>
      </CardContent>
    </Card>
  );
}
