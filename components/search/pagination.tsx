import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
  basePath?: string;
}

function buildHref(basePath: string, searchParams: PaginationProps["searchParams"], page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page" || value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.set(key, value);
    }
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Windowed page numbers with ellipses, e.g. 1 … 4 5 [6] 7 8 … 12 */
function getPageWindow(current: number, total: number): (number | "ellipsis")[] {
  const window = 1;
  const pages = new Set<number>([1, total, current]);
  for (let i = current - window; i <= current + window; i++) {
    if (i > 0 && i <= total) pages.add(i);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (index > 0 && previous !== undefined && page - previous > 1) result.push("ellipsis");
    result.push(page);
  });
  return result;
}

export function Pagination({ currentPage, totalPages, searchParams, basePath = "/search" }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageWindow(currentPage, totalPages);

  return (
    <nav aria-label="Navigasi halaman" className="flex items-center justify-center gap-1.5">
      <PageLink
        href={buildHref(basePath, searchParams, currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Halaman sebelumnya"
      >
        <ChevronLeft className="size-4" />
      </PageLink>

      {pages.map((page, index) =>
        page === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted-foreground">
            …
          </span>
        ) : (
          <PageLink key={page} href={buildHref(basePath, searchParams, page)} active={page === currentPage}>
            {page}
          </PageLink>
        )
      )}

      <PageLink
        href={buildHref(basePath, searchParams, currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Halaman berikutnya"
      >
        <ChevronRight className="size-4" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  active,
  disabled,
  children,
  ...props
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const classes = cn(
    "data-tag inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-2 text-sm transition-colors",
    active
      ? "border-transparent bg-accent text-accent-foreground"
      : "border-border text-foreground hover:bg-surface-hover",
    disabled && "pointer-events-none opacity-40"
  );

  if (disabled) {
    return (
      <span className={classes} {...props}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={classes} {...props}>
      {children}
    </Link>
  );
}
