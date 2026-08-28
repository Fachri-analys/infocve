import { Database, ShieldAlert, Activity, GitFork } from "lucide-react";
import { cn } from "@/lib/utils";

interface SourceBadgeProps {
  sources?: string[];
  className?: string;
}

export function SourceBadge({ sources = ["NVD"], className }: SourceBadgeProps) {
  const sourceIcons: Record<string, { label: string; icon: typeof Database; color: string }> = {
    NVD: { label: "NVD (NIST)", icon: Database, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    CISA_KEV: { label: "CISA KEV", icon: ShieldAlert, color: "text-red-500 bg-red-500/10 border-red-500/20" },
    EPSS: { label: "FIRST EPSS", icon: Activity, color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
    GHSA: { label: "GitHub Advisories", icon: GitFork, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {sources.map((src) => {
        const meta = sourceIcons[src] || { label: src, icon: Database, color: "text-muted-foreground bg-surface-hover border-border" };
        const Icon = meta.icon;
        return (
          <span
            key={src}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-tight",
              meta.color
            )}
          >
            <Icon className="size-3" />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}
