import Link from "next/link";
import {
  Building2,
  Cloud,
  Globe,
  Layers,
  Network,
  Server,
  type LucideIcon,
} from "lucide-react";

import type { CVECategory } from "@/types/cve";

const CATEGORY_ICONS: Record<CVECategory, LucideIcon> = {
  "web-application": Globe,
  network: Network,
  "operating-system": Server,
  "framework-library": Layers,
  "enterprise-software": Building2,
  "cloud-infrastructure": Cloud,
};

interface CategoryCardProps {
  slug: CVECategory;
  name: string;
  descriptionId: string;
  count: number;
}

export function CategoryCard({ slug, name, descriptionId, count }: CategoryCardProps) {
  const Icon = CATEGORY_ICONS[slug];

  return (
    <Link
      href={`/search?category=${slug}`}
      className="group flex min-w-0 items-start gap-3 border-b border-border py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center border border-border bg-surface text-muted-foreground transition-colors group-hover:border-accent/40 group-hover:bg-accent/10 group-hover:text-accent">
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-sm font-semibold text-foreground transition-colors group-hover:text-accent">{name}</h3>
          <span className="data-tag shrink-0 text-[10px] text-muted-foreground group-hover:text-accent">{count} CVE</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{descriptionId}</p>
      </div>
    </Link>
  );
}
