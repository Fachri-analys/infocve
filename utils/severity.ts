import type { Severity } from "@/types/cve";

/** Canonical ordering, most severe first — drives sorting and filter layout. */
export const SEVERITY_ORDER: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"];

export const SEVERITY_LABEL_ID: Record<Severity, string> = {
  CRITICAL: "Kritis",
  HIGH: "Tinggi",
  MEDIUM: "Sedang",
  LOW: "Rendah",
  NONE: "Tidak Ada",
};

/**
 * Tailwind class fragments per severity. Badges use a translucent tint of
 * the severity color for background/border/dot (consistent branding across
 * themes), but `.text` points at a separate "-fg" token — a same-hue color
 * that's darkened specifically for the light theme (see styles/globals.css)
 * after computing that the tint-matches-text approach, while comfortably
 * passing WCAG AA on the dark background, fails it on the light one.
 */
export const SEVERITY_CLASSES: Record<Severity, { text: string; bg: string; border: string; dot: string }> = {
  CRITICAL: {
    text: "text-severity-critical-fg",
    bg: "bg-severity-critical/12",
    border: "border-severity-critical/30",
    dot: "bg-severity-critical",
  },
  HIGH: {
    text: "text-severity-high-fg",
    bg: "bg-severity-high/12",
    border: "border-severity-high/30",
    dot: "bg-severity-high",
  },
  MEDIUM: {
    text: "text-severity-medium-fg",
    bg: "bg-severity-medium/12",
    border: "border-severity-medium/30",
    dot: "bg-severity-medium",
  },
  LOW: {
    text: "text-severity-low-fg",
    bg: "bg-severity-low/12",
    border: "border-severity-low/30",
    dot: "bg-severity-low",
  },
  NONE: {
    text: "text-severity-none-fg",
    bg: "bg-severity-none/12",
    border: "border-severity-none/30",
    dot: "bg-severity-none",
  },
};

export function isValidSeverity(value: string): value is Severity {
  return (SEVERITY_ORDER as string[]).includes(value);
}
