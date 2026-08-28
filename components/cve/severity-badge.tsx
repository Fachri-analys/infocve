import type { Severity } from "@/types/cve";
import { SEVERITY_CLASSES, SEVERITY_LABEL_ID } from "@/utils/severity";
import { cn } from "@/lib/utils";

interface SeverityBadgeProps {
  severity: Severity;
  size?: "sm" | "md";
  showDot?: boolean;
  className?: string;
}

/**
 * The one badge every list/card/detail view in the app reuses. Colors are
 * fixed by the brief: Critical=red, High=orange, Medium=yellow, Low=blue,
 * None=gray — applied as a translucent tint + border rather than a solid
 * fill, so it holds contrast in both themes.
 */
export function SeverityBadge({ severity, size = "md", showDot = true, className }: SeverityBadgeProps) {
  const classes = SEVERITY_CLASSES[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        classes.bg,
        classes.text,
        classes.border,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      {showDot && <span className={cn("size-1.5 rounded-full", classes.dot)} aria-hidden="true" />}
      {SEVERITY_LABEL_ID[severity]}
    </span>
  );
}
