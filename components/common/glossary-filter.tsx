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
    <div className="mt-10">
      <div className="mb-8 grid gap-4 border-y border-border py-5 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center sm:gap-8">
        <div className="relative">
          <label htmlFor="glossary-search" className="sr-only">Cari istilah glosarium</label>
          <span aria-hidden="true" className="data-tag pointer-events-none absolute left-0 top-1/2 hidden -translate-y-1/2 border-r border-border pr-3 text-[10px] text-muted-foreground sm:block">FIND /</span>
          <Search className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-accent sm:left-20" aria-hidden="true" />
        <input
          id="glossary-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari istilah, misalnya “XSS” atau “akses”…"
          aria-describedby="glossary-result-count"
          className="h-12 w-full border-b-2 border-border bg-background pl-7 pr-12 text-sm text-foreground placeholder:text-muted-foreground/70 transition-[background-color,border-color,color,box-shadow] duration-200 hover:border-border-hover focus-visible:border-accent focus-visible:outline-none focus-visible:ring-0 sm:pl-28"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Hapus pencarian istilah"
            className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color,transform] duration-200 hover:bg-surface-hover hover:text-foreground active:bg-accent/10 active:text-accent active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        )}
        </div>

        <div id="glossary-result-count" role="status" aria-live="polite" className="flex items-end justify-between gap-3 sm:block">
          <p className="data-tag text-2xl font-medium leading-none text-foreground">
            {filtered.length.toString().padStart(2, "0")}<span className="text-muted-foreground"> / {terms.length.toString().padStart(2, "0")}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">istilah ditemukan</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Istilah tidak ditemukan" description="Coba kata kunci lain, misalnya sebagian dari singkatannya." />
      ) : (
        <>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-2 text-[10px]">Referensi cepat</p>
              <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">Daftar istilah</h2>
            </div>
            <span className="data-tag text-[10px] uppercase tracking-wider text-muted-foreground">Urutan sesuai kamus</span>
          </div>
          <Accordion type="single" collapsible className="grid grid-cols-1 items-start gap-px border border-border bg-border sm:grid-cols-2">
          {filtered.map((term, index) => (
            <AccordionItem key={term.slug} value={term.slug} className="glossary-term">
              <AccordionTrigger className="min-h-20 rounded-none px-4 py-5 sm:px-5">
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span aria-hidden="true" className="data-tag mr-1 text-[10px] text-muted-foreground">{(index + 1).toString().padStart(2, "0")}</span>
                  <span className="data-tag text-lg font-medium text-accent">{term.term}</span>
                  {term.abbreviation && <span className="text-sm text-muted-foreground">({term.abbreviation})</span>}
                </span>
              </AccordionTrigger>
              <AccordionContent className="max-w-prose pl-11 pr-5 pb-6 leading-7 sm:pl-14">{term.definitionId}</AccordionContent>
            </AccordionItem>
          ))}
          </Accordion>
        </>
      )}
    </div>
  );
}
