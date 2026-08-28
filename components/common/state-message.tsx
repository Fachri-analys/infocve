import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface StateMessageProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: "neutral" | "critical";
  action?: React.ReactNode;
  className?: string;
}

/**
 * Shared layout for "nothing to show" states — empty search results, route
 * errors, and 404s all render through this so the visual language stays
 * identical and none of the three components duplicate layout logic.
 */
export function StateMessage({ icon: Icon, title, description, tone = "neutral", action, className }: StateMessageProps) {
  return (
    <div className={cn("glass flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center", className)}>
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-full",
          tone === "critical" ? "bg-severity-critical/12 text-severity-critical-fg" : "bg-accent/12 text-accent"
        )}
      >
        <Icon className="size-6" />
      </span>
      <h2 className="font-display text-lg font-medium text-foreground">{title}</h2>
      {description && <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
