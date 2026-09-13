import "server-only";

import type { CVE, EPSSScore, Severity } from "@/types/cve";
import { getFacetSample } from "@/lib/nvd";
import { CisaKevSourceAdapter, type CisaKevEntry } from "@/lib/sources/cisa-kev";
import { EpssSourceAdapter } from "@/lib/sources/epss";
import { calculatePriority } from "@/lib/priority";

export interface SeverityCount {
  severity: Severity | "UNKNOWN";
  labelId: string;
  count: number;
  percentage: number;
  color: string;
  bgClass: string;
}

export interface ScoreBracket {
  range: string;
  label: string;
  count: number;
  percentage: number;
}

export interface CvssStats {
  averageScore: number;
  medianScore: number;
  maxScore: number;
  ratedCount: number;
  unratedCount: number;
  brackets: ScoreBracket[];
  versionDistribution: { version: string; count: number }[];
}

export interface CisaKevStats {
  sampleInKev: number;
  sampleInKevPercentage: number;
  catalogTotal: number;
  ransomwareCount: number;
  topKevVendors: { vendor: string; count: number }[];
}

export interface EpssStats {
  evaluatedCount: number;
  highRiskCount: number;
  criticalRiskCount: number;
  averageProbability: number;
  topEpssCves: { id: string; score: number; percentile: number; cvssScore?: number }[];
}

export interface PriorityTierCount {
  tier: "P1" | "P2" | "P3" | "P4";
  labelId: string;
  actionGuidance: string;
  count: number;
  percentage: number;
  colorClass: string;
  bgClass: string;
}

export interface TrendDataPoint {
  periodKey: string;
  label: string;
  total: number;
  critical: number;
  high: number;
}

export interface TopRankItem {
  name: string;
  count: number;
  percentage: number;
}

export interface TopCweItem {
  id: string;
  name: string;
  count: number;
  percentage: number;
}

export interface DashboardData {
  totalSampleCves: number;
  sampleTimeRangeDays: number;
  generatedAt: string;
  severityDistribution: SeverityCount[];
  cvssStats: CvssStats;
  cisaKevStats: CisaKevStats;
  epssStats: EpssStats;
  priorityStats: PriorityTierCount[];
  topVendors: TopRankItem[];
  topProducts: TopRankItem[];
  topCwes: TopCweItem[];
  trend: TrendDataPoint[];
  highlights: {
    urgentCount: number;
    cisaKevCount: number;
    criticalCount: number;
    epssHighThreatCount: number;
  };
}

const SEVERITY_CONFIG: Record<
  Severity | "UNKNOWN",
  { labelId: string; color: string; bgClass: string; sortOrder: number }
> = {
  CRITICAL: {
    labelId: "Kritis (9.0 - 10.0)",
    color: "#dc2626",
    bgClass: "bg-red-500",
    sortOrder: 1,
  },
  HIGH: {
    labelId: "Tinggi (7.0 - 8.9)",
    color: "#ea580c",
    bgClass: "bg-orange-500",
    sortOrder: 2,
  },
  MEDIUM: {
    labelId: "Sedang (4.0 - 6.9)",
    color: "#d97706",
    bgClass: "bg-amber-500",
    sortOrder: 3,
  },
  LOW: {
    labelId: "Rendah (0.1 - 3.9)",
    color: "#16a34a",
    bgClass: "bg-emerald-500",
    sortOrder: 4,
  },
  NONE: {
    labelId: "Nol / Tidak Berdampak (0.0)",
    color: "#9ca3af",
    bgClass: "bg-zinc-400",
    sortOrder: 5,
  },
  UNKNOWN: {
    labelId: "Belum Dinilai",
    color: "#6b7280",
    bgClass: "bg-zinc-500",
    sortOrder: 6,
  },
};

export function computeSeverityDistribution(cves: CVE[]): SeverityCount[] {
  const total = cves.length;
  const counts: Record<Severity | "UNKNOWN", number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    NONE: 0,
    UNKNOWN: 0,
  };

  for (const cve of cves) {
    const sev = cve.cvss?.severity;
    if (sev && sev in counts) {
      counts[sev]++;
    } else {
      counts.UNKNOWN++;
    }
  }

  return (Object.keys(counts) as (Severity | "UNKNOWN")[])
    .sort((a, b) => SEVERITY_CONFIG[a].sortOrder - SEVERITY_CONFIG[b].sortOrder)
    .map((sev) => {
      const count = counts[sev];
      const percentage = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
      return {
        severity: sev,
        labelId: SEVERITY_CONFIG[sev].labelId,
        count,
        percentage,
        color: SEVERITY_CONFIG[sev].color,
        bgClass: SEVERITY_CONFIG[sev].bgClass,
      };
    });
}

export function computeCvssStats(cves: CVE[]): CvssStats {
  const scores: number[] = [];
  const versionMap = new Map<string, number>();

  let bCritical = 0;
  let bHigh = 0;
  let bMedium = 0;
  let bLow = 0;
  let bUnrated = 0;

  for (const cve of cves) {
    const score = cve.cvss?.baseScore;
    const version = cve.cvss?.version;

    if (typeof score === "number" && score > 0) {
      scores.push(score);

      if (version) {
        versionMap.set(version, (versionMap.get(version) ?? 0) + 1);
      }

      if (score >= 9.0) bCritical++;
      else if (score >= 7.0) bHigh++;
      else if (score >= 4.0) bMedium++;
      else bLow++;
    } else {
      bUnrated++;
    }
  }

  const ratedCount = scores.length;
  const total = cves.length;

  let averageScore = 0;
  let medianScore = 0;
  let maxScore = 0;

  if (ratedCount > 0) {
    scores.sort((a, b) => a - b);
    const sum = scores.reduce((acc, val) => acc + val, 0);
    averageScore = Math.round((sum / ratedCount) * 10) / 10;
    maxScore = scores[scores.length - 1] ?? 0;

    const mid = Math.floor(ratedCount / 2);
    const midVal = scores[mid] ?? 0;
    const prevVal = scores[mid - 1] ?? midVal;
    medianScore = ratedCount % 2 !== 0 ? midVal : Math.round(((prevVal + midVal) / 2) * 10) / 10;
  }

  const toPercent = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);

  const brackets: ScoreBracket[] = [
    { range: "9.0 - 10.0", label: "Kritis", count: bCritical, percentage: toPercent(bCritical) },
    { range: "7.0 - 8.9", label: "Tinggi", count: bHigh, percentage: toPercent(bHigh) },
    { range: "4.0 - 6.9", label: "Sedang", count: bMedium, percentage: toPercent(bMedium) },
    { range: "0.1 - 3.9", label: "Rendah", count: bLow, percentage: toPercent(bLow) },
    { range: "N/A", label: "Belum Dinilai", count: bUnrated, percentage: toPercent(bUnrated) },
  ];

  const versionDistribution = [...versionMap.entries()]
    .map(([version, count]) => ({ version, count }))
    .sort((a, b) => b.count - a.count);

  return {
    averageScore,
    medianScore,
    maxScore,
    ratedCount,
    unratedCount: bUnrated,
    brackets,
    versionDistribution,
  };
}

export function computeTopItems<T>(items: T[], keyFn: (item: T) => string, limit = 10): TopRankItem[] {
  const total = items.length;
  if (total === 0) return [];

  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item)?.trim();
    if (key && key.toLowerCase() !== "unknown" && key.toLowerCase() !== "n/a") {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    }));
}

export function computeTopCwes(cves: CVE[], limit = 10): TopCweItem[] {
  const total = cves.length;
  if (total === 0) return [];

  const map = new Map<string, { name: string; count: number }>();

  for (const cve of cves) {
    for (const cwe of cve.cwe || []) {
      if (!cwe.id || cwe.id === "NVD-CWE-noinfo" || cwe.id === "NVD-CWE-Other") continue;
      const existing = map.get(cwe.id);
      if (existing) {
        existing.count++;
      } else {
        map.set(cwe.id, { name: cwe.name || cwe.id, count: 1 });
      }
    }
  }

  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([id, data]) => ({
      id,
      name: data.name,
      count: data.count,
      percentage: Math.round((data.count / total) * 1000) / 10,
    }));
}

export function computeTrend(cves: CVE[]): TrendDataPoint[] {
  if (cves.length === 0) return [];

  const buckets = new Map<string, { label: string; total: number; critical: number; high: number; dateTs: number }>();

  for (const cve of cves) {
    if (!cve.publishedDate) continue;
    const d = new Date(cve.publishedDate);
    if (isNaN(d.getTime())) continue;

    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);

    const year = weekStart.getFullYear();
    const month = String(weekStart.getMonth() + 1).padStart(2, "0");
    const dateNum = String(weekStart.getDate()).padStart(2, "0");
    const key = `${year}-${month}-${dateNum}`;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const label = `${weekStart.getDate()} ${monthNames[weekStart.getMonth()]}`;

    const existing = buckets.get(key) ?? {
      label,
      total: 0,
      critical: 0,
      high: 0,
      dateTs: weekStart.getTime(),
    };

    existing.total++;
    if (cve.cvss?.severity === "CRITICAL") existing.critical++;
    if (cve.cvss?.severity === "HIGH") existing.high++;

    buckets.set(key, existing);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[1].dateTs - b[1].dateTs)
    .map(([key, data]) => ({
      periodKey: key,
      label: data.label,
      total: data.total,
      critical: data.critical,
      high: data.high,
    }));
}

export function computePriorityBreakdown(cves: CVE[]): PriorityTierCount[] {
  const total = cves.length;
  const counts: Record<"P1" | "P2" | "P3" | "P4", number> = {
    P1: 0,
    P2: 0,
    P3: 0,
    P4: 0,
  };

  for (const cve of cves) {
    const priority = cve.priority ?? calculatePriority(cve);
    if (priority?.tier && priority.tier in counts) {
      counts[priority.tier]++;
    } else {
      counts.P4++;
    }
  }

  const toPercent = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);

  return [
    {
      tier: "P1",
      labelId: "Prioritas Kritis (P1)",
      actionGuidance: "Remediasi segera dalam 24-48 jam. Terdaftar di CISA KEV atau ancaman eksploitasi nyata sangat tinggi.",
      count: counts.P1,
      percentage: toPercent(counts.P1),
      colorClass: "text-red-500",
      bgClass: "bg-red-500",
    },
    {
      tier: "P2",
      labelId: "Prioritas Tinggi (P2)",
      actionGuidance: "Remediasi terencana siklus cepat (7-14 hari). Kerentanan CVSS Kritis atau High dengan bukti eksploitasi publik (PoC).",
      count: counts.P2,
      percentage: toPercent(counts.P2),
      colorClass: "text-orange-500",
      bgClass: "bg-orange-500",
    },
    {
      tier: "P3",
      labelId: "Perhatian Sedang (P3)",
      actionGuidance: "Jadwalkan dalam siklus patch reguler bulanan. Kerentanan dengan dampak moderat atau memiliki probabilitas eksploitasi menengah.",
      count: counts.P3,
      percentage: toPercent(counts.P3),
      colorClass: "text-amber-500",
      bgClass: "bg-amber-500",
    },
    {
      tier: "P4",
      labelId: "Risiko Rendah (P4)",
      actionGuidance: "Pantau dan tangani saat pemeliharaan rutin. Dampak terbatas tanpa indikasi eksploitasi aktif.",
      count: counts.P4,
      percentage: toPercent(counts.P4),
      colorClass: "text-emerald-500",
      bgClass: "bg-emerald-500",
    },
  ];
}

export function computeCisaKevStats(cves: CVE[], cisaMap: Map<string, CisaKevEntry>): CisaKevStats {
  const sampleInKev = cves.filter((c) => cisaMap.has(c.id.toUpperCase())).length;
  const sampleInKevPercentage = cves.length > 0 ? Math.round((sampleInKev / cves.length) * 1000) / 10 : 0;

  let ransomwareCount = 0;
  const kevVendorCounts = new Map<string, number>();

  for (const entry of cisaMap.values()) {
    if (entry.knownRansomwareCampaignUse && entry.knownRansomwareCampaignUse.toLowerCase() === "known") {
      ransomwareCount++;
    }
    const vendor = entry.vendorProject?.trim();
    if (vendor) {
      kevVendorCounts.set(vendor, (kevVendorCounts.get(vendor) ?? 0) + 1);
    }
  }

  const topKevVendors = [...kevVendorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([vendor, count]) => ({ vendor, count }));

  return {
    sampleInKev,
    sampleInKevPercentage,
    catalogTotal: cisaMap.size,
    ransomwareCount,
    topKevVendors,
  };
}

export function computeEpssStats(
  cves: CVE[],
  epssMap: Map<string, EPSSScore>
): EpssStats {
  const matchedScores: { id: string; score: number; percentile: number; cvssScore?: number }[] = [];

  for (const cve of cves) {
    const epss = epssMap.get(cve.id.toUpperCase()) || cve.epss;
    if (epss && typeof epss.score === "number") {
      matchedScores.push({
        id: cve.id,
        score: epss.score,
        percentile: epss.percentile,
        cvssScore: cve.cvss?.baseScore,
      });
    }
  }

  const evaluatedCount = matchedScores.length;
  let highRiskCount = 0;
  let criticalRiskCount = 0;
  let totalScore = 0;

  for (const item of matchedScores) {
    totalScore += item.score;
    if (item.score > 0.5) criticalRiskCount++;
    else if (item.score > 0.1) highRiskCount++;
  }

  const averageProbability = evaluatedCount > 0 ? Math.round((totalScore / evaluatedCount) * 1000) / 10 : 0;

  matchedScores.sort((a, b) => b.score - a.score);

  return {
    evaluatedCount,
    highRiskCount,
    criticalRiskCount,
    averageProbability,
    topEpssCves: matchedScores.slice(0, 5),
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const cisaKevAdapter = new CisaKevSourceAdapter();
  const epssAdapter = new EpssSourceAdapter();

  try {
    const [sampleCves, cisaCatalog] = await Promise.all([
      getFacetSample().catch(() => [] as CVE[]),
      cisaKevAdapter.fetchCatalog().catch(() => new Map<string, CisaKevEntry>()),
    ]);

    for (const cve of sampleCves) {
      const kevEntry = cisaCatalog.get(cve.id.toUpperCase());
      if (kevEntry) {
        cve.cisaKev = {
          isKev: true,
          dateAdded: kevEntry.dateAdded,
          dueDate: kevEntry.dueDate,
          requiredAction: kevEntry.requiredAction,
          notes: kevEntry.notes,
        };
      }
    }

    const priorityCandidates = sampleCves
      .filter((c) => c.cvss?.severity === "CRITICAL" || c.cisaKev?.isKev)
      .slice(0, 100);

    const candidateIds = priorityCandidates.map((c) => c.id);
    const epssMap = candidateIds.length > 0
      ? await epssAdapter.fetchBatch(candidateIds).catch(() => new Map<string, EPSSScore>())
      : new Map<string, EPSSScore>();

    for (const cve of priorityCandidates) {
      const score = epssMap.get(cve.id.toUpperCase());
      if (score) {
        cve.epss = score;
      }
    }

    const severityDistribution = computeSeverityDistribution(sampleCves);
    const cvssStats = computeCvssStats(sampleCves);
    const cisaKevStats = computeCisaKevStats(sampleCves, cisaCatalog);
    const epssStats = computeEpssStats(priorityCandidates, epssMap);
    const priorityStats = computePriorityBreakdown(sampleCves);
    const topVendors = computeTopItems(sampleCves, (c) => c.vendor, 8);
    const topProducts = computeTopItems(sampleCves, (c) => c.product, 8);
    const topCwes = computeTopCwes(sampleCves, 8);
    const trend = computeTrend(sampleCves);

    const criticalCount = severityDistribution.find((s) => s.severity === "CRITICAL")?.count ?? 0;
    const urgentCount = priorityStats.find((p) => p.tier === "P1")?.count ?? 0;

    return {
      totalSampleCves: sampleCves.length,
      sampleTimeRangeDays: 120,
      generatedAt: new Date().toISOString(),
      severityDistribution,
      cvssStats,
      cisaKevStats,
      epssStats,
      priorityStats,
      topVendors,
      topProducts,
      topCwes,
      trend,
      highlights: {
        urgentCount,
        cisaKevCount: cisaKevStats.sampleInKev,
        criticalCount,
        epssHighThreatCount: epssStats.highRiskCount + epssStats.criticalRiskCount,
      },
    };
  } catch (error) {
    console.error("[Dashboard] Error compiling dashboard data:", error);
    return {
      totalSampleCves: 0,
      sampleTimeRangeDays: 120,
      generatedAt: new Date().toISOString(),
      severityDistribution: computeSeverityDistribution([]),
      cvssStats: computeCvssStats([]),
      cisaKevStats: {
        sampleInKev: 0,
        sampleInKevPercentage: 0,
        catalogTotal: 0,
        ransomwareCount: 0,
        topKevVendors: [],
      },
      epssStats: {
        evaluatedCount: 0,
        highRiskCount: 0,
        criticalRiskCount: 0,
        averageProbability: 0,
        topEpssCves: [],
      },
      priorityStats: computePriorityBreakdown([]),
      topVendors: [],
      topProducts: [],
      topCwes: [],
      trend: [],
      highlights: {
        urgentCount: 0,
        cisaKevCount: 0,
        criticalCount: 0,
        epssHighThreatCount: 0,
      },
    };
  }
}
