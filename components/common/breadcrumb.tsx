import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
      <Link href="/" className="flex items-center gap-1 hover:text-foreground" aria-label="Beranda">
        <Home className="size-3.5" />
      </Link>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <ChevronRight className="size-3.5" aria-hidden="true" />
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="data-tag text-foreground" aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
