import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

interface SearchBarProps {
  defaultValue?: string;
  size?: "lg" | "md";
  className?: string;
}

/**
 * A native <form method="GET"> — works with zero client-side JavaScript.
 * Submitting navigates to /search?q=..., where the search page (a Server
 * Component) reads `searchParams` and renders results. This keeps the most
 * important interaction on the site fast and resilient even if JS is slow
 * to load or disabled.
 */
export function SearchBar({ defaultValue = "", size = "md", className }: SearchBarProps) {
  return (
    <form action="/search" method="GET" className={cn("relative flex w-full items-center", className)}>
      <Search
        className={cn(
          "pointer-events-none absolute left-4 text-muted-foreground",
          size === "lg" ? "size-5" : "size-4"
        )}
      />
      <input
        type="text"
        name="q"
        defaultValue={defaultValue}
        placeholder="Cari CVE ID, vendor, produk, atau kata kunci…"
        aria-label="Cari CVE"
        className={cn(
          "data-tag w-full rounded-full border border-border bg-surface text-foreground placeholder:text-muted-foreground/70",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent",
          size === "lg" ? "h-14 pl-12 pr-32 text-base" : "h-11 pl-10 pr-24 text-sm"
        )}
      />
      <button
        type="submit"
        className={cn(
          "absolute right-1.5 inline-flex items-center justify-center rounded-full bg-accent font-medium text-accent-foreground transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          size === "lg" ? "h-11 px-6 text-sm" : "h-8 px-4 text-xs"
        )}
      >
        Cari
      </button>
    </form>
  );
}
