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
    <Link href={`/search?category=${slug}`} className="block h-full">
      <Card className="flex h-full flex-col gap-3 p-5 transition-transform duration-200 hover:-translate-y-0.5 hover:border-border-hover">
        <div className="flex items-center justify-between">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent/12 text-accent">
            <Icon className="size-5" />
          </span>
          <span className="data-tag text-xs text-muted-foreground">{count} CVE</span>
        </div>
        <div>
          <h3 className="font-display text-sm font-medium text-foreground">{name}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{descriptionId}</p>
        </div>
      </Card>
    </Link>
  );
}
