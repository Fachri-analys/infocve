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
    <div className={cn(
      "mx-auto flex max-w-2xl flex-col items-start gap-4 border-y border-r border-border bg-surface px-5 py-12 text-left sm:px-8 sm:py-16",
      tone === "critical" ? "border-l-2 border-l-severity-critical" : "border-l-2 border-l-accent",
      className
    )}>
      <span
        className={cn(
          "flex size-10 items-center justify-center border",
          tone === "critical" ? "border-severity-critical/25 bg-severity-critical/10 text-severity-critical-fg" : "border-accent/25 bg-accent/10 text-accent"
        )}
      >
        <Icon className="size-5" />
      </span>
      <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">{title}</h2>
      {description && <p className="max-w-md text-sm leading-7 text-muted-foreground">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
