"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import type { GlossaryTerm } from "@/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { EmptyState } from "@/components/common/empty-state";
import { useDebounce } from "@/hooks/use-debounce";

export function GlossaryFilter({ terms }: { terms: GlossaryTerm[] }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 200);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return terms;
    return terms.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        t.abbreviation?.toLowerCase().includes(q) ||
        t.definitionId.toLowerCase().includes(q)
    );
  }, [terms, debouncedQuery]);

  return (
    <div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="glossary-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari istilah, misalnya “XSS” atau “akses”…"
          aria-label="Cari istilah glosarium"
          className="h-12 w-full rounded-xl border border-border bg-surface pl-11 pr-12 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Hapus pencarian istilah"
            className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="mb-5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{filtered.length} istilah ditampilkan</span>
        <span className="hidden sm:inline">Pilih istilah untuk membuka penjelasan</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Istilah tidak ditemukan" description="Coba kata kunci lain, misalnya sebagian dari singkatannya." />
      ) : (
        <Accordion type="single" collapsible className="flex flex-col gap-3">
          {filtered.map((term) => (
            <AccordionItem key={term.slug} value={term.slug}>
              <AccordionTrigger>
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="data-tag text-accent">{term.term}</span>
                  {term.abbreviation && <span className="text-sm text-muted-foreground">({term.abbreviation})</span>}
                </span>
              </AccordionTrigger>
              <AccordionContent>{term.definitionId}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
