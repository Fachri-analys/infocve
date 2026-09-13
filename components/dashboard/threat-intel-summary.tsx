import Link from "next/link";
import { Activity, ExternalLink, Flame, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumberId } from "@/utils/format";
import type { CisaKevStats, EpssStats } from "@/lib/dashboard-stats";

interface ThreatIntelSummaryProps {
  cisaKevStats: CisaKevStats;
  epssStats: EpssStats;
}

export function ThreatIntelSummary({ cisaKevStats, epssStats }: ThreatIntelSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* CISA KEV Intelligence */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="size-4 text-red-500" />
              <CardTitle className="text-base font-semibold">CISA Known Exploited Vulnerabilities</CardTitle>
            </div>
            <a
              href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-accent"
            >
              Katalog Resmi CISA <ExternalLink className="size-3" />
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Data resmi CISA AS mengenai kerentanan yang terbukti dieksploitasi dalam serangan siber nyata.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-background-raised/30 p-3">
            <div>
              <p className="text-xs text-muted-foreground">Di Sampel 120 Hari</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mono text-2xl font-bold text-red-500">
                  {formatNumberId(cisaKevStats.sampleInKev)}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({cisaKevStats.sampleInKevPercentage}%)
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Katalog Global</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mono text-2xl font-bold text-foreground">
                  {formatNumberId(cisaKevStats.catalogTotal)}
                </span>
                <span className="text-xs text-muted-foreground">CVE</span>
              </div>
            </div>
          </div>

          <div>
            <h5 className="text-xs font-medium text-foreground">Vendor Paling Sering Muncul di KEV Global:</h5>
            <div className="mt-2 flex flex-wrap gap-2">
              {cisaKevStats.topKevVendors.map((item) => (
                <span
                  key={item.vendor}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground"
                >
                  <span>{item.vendor}</span>
                  <span className="rounded bg-background px-1 text-[11px] font-mono text-muted-foreground">
                    {item.count}
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="flex items-start gap-1.5">
              <Info className="mt-0.5 size-3.5 shrink-0 text-blue-500" />
              <span>
                <strong>Catatan Intelijen:</strong> Kerentanan yang masuk CISA KEV berstatus bahaya mendesak karena
                sudah memiliki eksploitasi aktif di dunia nyata, terlepas dari apakah skor CVSS bernilai sedang atau kritis.
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* EPSS Prediction Intelligence */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-purple-500" />
              <CardTitle className="text-base font-semibold">Prediksi Eksploitasi (EPSS FIRST.org)</CardTitle>
            </div>
            <a
              href="https://www.first.org/epss/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-accent"
            >
              Model EPSS <ExternalLink className="size-3" />
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Model probabilitas FIRST.org memperkirakan kemungkinan kerentanan dieksploitasi dalam 30 hari ke depan.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-background-raised/30 p-3">
            <div>
              <p className="text-xs text-muted-foreground">Risiko Kritis (EPSS &gt; 50%)</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mono text-2xl font-bold text-purple-600">
                  {formatNumberId(epssStats.criticalRiskCount)}
                </span>
                <span className="text-xs text-muted-foreground">CVE</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Risiko Tinggi (EPSS &gt; 10%)</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mono text-2xl font-bold text-purple-400">
                  {formatNumberId(epssStats.highRiskCount)}
                </span>
                <span className="text-xs text-muted-foreground">CVE</span>
              </div>
            </div>
          </div>

          <div>
            <h5 className="text-xs font-medium text-foreground">Kerentanan Sampel dengan EPSS Tertinggi:</h5>
            {epssStats.topEpssCves.length > 0 ? (
              <div className="mt-2 space-y-2">
                {epssStats.topEpssCves.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-md border border-border/80 bg-background/50 px-3 py-1.5 text-xs"
                  >
                    <Link
                      href={`/cve/${item.id}`}
                      className="font-mono font-medium text-accent hover:underline"
                    >
                      {item.id}
                    </Link>
                    <div className="flex items-center gap-3">
                      {typeof item.cvssScore === "number" && (
                        <span className="text-muted-foreground font-mono">
                          CVSS: {item.cvssScore.toFixed(1)}
                        </span>
                      )}
                      <span className="rounded bg-purple-500/10 px-2 py-0.5 font-mono font-semibold text-purple-500">
                        {(item.score * 100).toFixed(1)}% probabilitas
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Evaluasi EPSS sedang disinkronkan untuk kerentanan terkini.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="flex items-start gap-1.5">
              <Info className="mt-0.5 size-3.5 shrink-0 text-purple-500" />
              <span>
                <strong>Efisiensi Patching:</strong> Memprioritaskan kerentanan berdasarkan kombinasi CVSS dan EPSS
                membantu tim keamanan menutup 80%+ ancaman nyata dengan hanya mem-patch sebagian kecil CVE.
              </span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
