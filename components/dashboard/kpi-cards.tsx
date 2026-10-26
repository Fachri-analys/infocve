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
      iconColor: "text-accent",
      bgColor: "bg-accent/10",
      href: "/search",
    },
    {
      label: "Keparahan Kritis (CVSS >= 9.0)",
      value: formatNumberId(highlights.criticalCount),
      subtext: `${data.severityDistribution.find((s) => s.severity === "CRITICAL")?.percentage ?? 0}% dari total sampel`,
      icon: AlertTriangle,
      iconColor: "text-severity-critical-fg",
      bgColor: "bg-severity-critical/10",
      href: "/search?severity=CRITICAL",
    },
    {
      label: "Aktif Dieksploitasi (CISA KEV)",
      value: formatNumberId(highlights.cisaKevCount),
      subtext: "Tercantum dalam katalog CISA KEV",
      icon: Flame,
      iconColor: "text-severity-high-fg",
      bgColor: "bg-severity-high/10",
      href: "/sources",
    },
    {
      label: "Prioritas P1 InfoCVE",
      value: formatNumberId(highlights.urgentCount),
      subtext: "Rekomendasi tindakan segera (24-48 jam)",
      icon: ShieldAlert,
      iconColor: "text-severity-critical-fg",
      bgColor: "bg-severity-critical/10",
      href: "/search?severity=CRITICAL",
    },
    {
      label: "Rata-rata Skor CVSS",
      value: cvssStats.averageScore > 0 ? cvssStats.averageScore.toFixed(1) : "-",
      subtext: `Dari ${formatNumberId(cvssStats.ratedCount)} kerentanan bernilai`,
      icon: Activity,
      iconColor: "text-severity-medium-fg",
      bgColor: "bg-severity-medium/10",
    },
    {
      label: "Ancaman Eksploitasi Tinggi (EPSS)",
      value: formatNumberId(highlights.epssHighThreatCount),
      subtext: "Probabilitas eksploitasi EPSS > 10%",
      icon: CheckCircle,
      iconColor: "text-severity-high-fg",
      bgColor: "bg-severity-high/10",
      href: "/sources",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        const interactiveCardClasses = card.href
          ? "hover:border-accent/40 hover:bg-surface-hover"
          : "";
        const content = (
          <Card
            key={card.label}
            className={`group h-full flex flex-col justify-between rounded-none border-0 bg-background transition-colors duration-200 ${interactiveCardClasses}`}
          >
            <CardContent className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground truncate">{card.label}</p>
                  <h3 className="mt-2 font-mono text-2xl sm:text-3xl font-semibold tracking-tight text-foreground truncate">
                    {card.value}
                  </h3>
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1">{card.subtext}</p>
                </div>
                <div className={`flex size-10 shrink-0 items-center justify-center border border-border ${card.bgColor} transition-colors ${card.href ? "group-hover:border-accent/30" : ""}`}>
                  <Icon className={`size-4.5 ${card.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );

        if (card.href) {
          return (
            <Link key={card.label} href={card.href} className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              {content}
            </Link>
          );
        }

        return <div key={card.label} className="h-full">{content}</div>;
      })}
    </div>
  );
}
