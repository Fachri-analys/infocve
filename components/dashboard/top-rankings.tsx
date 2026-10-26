import Link from "next/link";
import { ArrowUpRight, Building2, Package, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumberId } from "@/utils/format";
import type { TopRankItem, TopCweItem } from "@/lib/dashboard-stats";

interface TopRankingsProps {
  topVendors: TopRankItem[];
  topProducts: TopRankItem[];
  topCwes: TopCweItem[];
}

export function TopRankings({ topVendors, topProducts, topCwes }: TopRankingsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Top Vendors */}
      <Card className="flex h-full flex-col justify-between rounded-none border-x-0 border-b-0 border-t-2 border-t-accent bg-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-blue-500" />
            <CardTitle className="text-base font-semibold">Top Vendor Terdampak</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Vendor dengan frekuensi kemunculan kerentanan terbanyak dalam sampel 120 hari.
          </p>
        </CardHeader>
        <CardContent className="pt-1 flex-1">
          <div className="space-y-2">
            {topVendors.map((item, index) => (
              <Link
                key={item.name}
                href={`/search?vendor=${encodeURIComponent(item.name)}`}
                className="flex items-center justify-between border-b border-border/70 px-1 py-2.5 text-xs transition-colors hover:bg-surface-hover/50"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span className="data-tag w-5 shrink-0 text-right text-[11px] text-muted-foreground">
                    #{index + 1}
                  </span>
                  <span className="font-medium text-foreground truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="data-tag border-l border-accent/60 bg-accent/10 px-1.5 py-0.5 text-[11px] text-foreground">
                    {formatNumberId(item.count)}
                  </span>
                  <ArrowUpRight className="size-3 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card className="flex h-full flex-col justify-between rounded-none border-x-0 border-b-0 border-t-2 border-t-severity-low bg-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Package className="size-4 text-emerald-500" />
            <CardTitle className="text-base font-semibold">Top Produk Terdampak</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Produk atau komponen perangkat lunak yang paling sering dilaporkan memiliki CVE.
          </p>
        </CardHeader>
        <CardContent className="pt-1 flex-1">
          <div className="space-y-2">
            {topProducts.map((item, index) => (
              <Link
                key={item.name}
                href={`/search?q=${encodeURIComponent(item.name)}`}
                className="flex items-center justify-between border-b border-border/70 px-1 py-2.5 text-xs transition-colors hover:bg-surface-hover/50"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span className="data-tag w-5 shrink-0 text-right text-[11px] text-muted-foreground">
                    #{index + 1}
                  </span>
                  <span className="font-medium text-foreground truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="data-tag border-l border-accent/60 bg-accent/10 px-1.5 py-0.5 text-[11px] text-foreground">
                    {formatNumberId(item.count)}
                  </span>
                  <ArrowUpRight className="size-3 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top CWE Weaknesses */}
      <Card className="flex h-full flex-col justify-between rounded-none border-x-0 border-b-0 border-t-2 border-t-severity-high bg-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-amber-500" />
            <CardTitle className="text-base font-semibold">Top Kelemahan (CWE)</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Pola kelemahan keamanan (Common Weakness Enumeration) yang paling sering menjadi akar masalah.
          </p>
        </CardHeader>
        <CardContent className="pt-1 flex-1">
          <div className="space-y-2">
            {topCwes.map((item, index) => (
              <Link
                key={item.id}
                href={`/search?cwe=${encodeURIComponent(item.id)}`}
                className="flex items-center justify-between border-b border-border/70 px-1 py-2.5 text-xs transition-colors hover:bg-surface-hover/50"
                title={`${item.id}: ${item.name}`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span className="data-tag w-5 shrink-0 text-right text-[11px] text-muted-foreground">
                    #{index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] font-semibold text-accent">{item.id}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">({item.percentage}%)</span>
                    </div>
                    <p className="font-medium text-foreground truncate text-[11px]">{item.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="data-tag border-l border-accent/60 bg-accent/10 px-1.5 py-0.5 text-[11px] text-foreground">
                    {formatNumberId(item.count)}
                  </span>
                  <ArrowUpRight className="size-3 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
