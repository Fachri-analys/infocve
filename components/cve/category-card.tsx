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
import { Card } from "@/components/ui/card";

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
    <Link href={`/search?category=${slug}`} className="group block h-full">
      <Card className="flex h-full flex-col gap-3 p-5 transition-colors duration-200 hover:border-accent/45 hover:bg-surface-hover/25">
        <div className="flex items-center justify-between">
          <span className="flex size-10 items-center justify-center rounded-lg bg-accent/12 text-accent">
            <Icon className="size-5" />
          </span>
          <span className="data-tag rounded-md border border-border bg-background/50 px-2 py-1 text-[11px] text-muted-foreground">{count} CVE</span>
        </div>
        <div>
          <h3 className="font-display text-sm font-medium text-foreground transition-colors group-hover:text-accent">{name}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{descriptionId}</p>
        </div>
      </Card>
    </Link>
  );
}
