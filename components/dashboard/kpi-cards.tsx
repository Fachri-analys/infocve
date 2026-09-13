import Link from "next/link";
import { ShieldAlert, AlertTriangle, Flame, Activity, Database, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumberId } from "@/utils/format";
import type { DashboardData } from "@/lib/dashboard-stats";

interface KpiCardsProps {
  data: DashboardData;
}

export function KpiCards({ data }: KpiCardsProps) {
  const { totalSampleCves, highlights, cvssStats } = data;

  const cards = [
    {
      label: "Total Kerentanan (120 Hari)",
      value: formatNumberId(totalSampleCves),
      subtext: "Sampel publikasi terkini NVD NIST",
      icon: Database,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500/10",
      href: "/search",
    },
    {
      label: "Keparahan Kritis (CVSS >= 9.0)",
      value: formatNumberId(highlights.criticalCount),
      subtext: `${data.severityDistribution.find((s) => s.severity === "CRITICAL")?.percentage ?? 0}% dari total sampel`,
      icon: AlertTriangle,
      iconColor: "text-red-500",
      bgColor: "bg-red-500/10",
      href: "/search?severity=CRITICAL",
    },
    {
      label: "Aktif Dieksploitasi (CISA KEV)",
      value: formatNumberId(highlights.cisaKevCount),
      subtext: "Tercantum dalam katalog CISA KEV",
      icon: Flame,
      iconColor: "text-rose-600",
      bgColor: "bg-rose-500/10",
      href: "/sources",
    },
    {
      label: "Prioritas P1 InfoCVE",
      value: formatNumberId(highlights.urgentCount),
      subtext: "Rekomendasi tindakan segera (24-48 jam)",
      icon: ShieldAlert,
      iconColor: "text-red-600",
      bgColor: "bg-red-500/10",
      href: "/search?severity=CRITICAL",
    },
    {
      label: "Rata-rata Skor CVSS",
      value: cvssStats.averageScore > 0 ? cvssStats.averageScore.toFixed(1) : "-",
      subtext: `Dari ${formatNumberId(cvssStats.ratedCount)} kerentanan bernilai`,
      icon: Activity,
      iconColor: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      label: "Ancaman Eksploitasi Tinggi (EPSS)",
      value: formatNumberId(highlights.epssHighThreatCount),
      subtext: "Probabilitas eksploitasi EPSS > 10%",
      icon: CheckCircle,
      iconColor: "text-purple-500",
      bgColor: "bg-purple-500/10",
      href: "/sources",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        const content = (
          <Card
            key={card.label}
            className="border-border transition-colors hover:border-foreground/20 hover:bg-background-raised/30"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                  <h3 className="mt-2 font-mono text-3xl font-semibold tracking-tight text-foreground">
                    {card.value}
                  </h3>
                  <p className="mt-1.5 text-xs text-muted-foreground">{card.subtext}</p>
                </div>
                <div className={`flex size-10 items-center justify-center rounded-lg ${card.bgColor}`}>
                  <Icon className={`size-5 ${card.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );

        if (card.href) {
          return (
            <Link key={card.label} href={card.href} className="block transition-transform hover:-translate-y-0.5">
              {content}
            </Link>
          );
        }

        return <div key={card.label}>{content}</div>;
      })}
    </div>
  );
}
