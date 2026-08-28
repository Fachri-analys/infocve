"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

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
      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari istilah, misalnya “XSS” atau “akses”…"
          aria-label="Cari istilah glosarium"
          className="h-12 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
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
