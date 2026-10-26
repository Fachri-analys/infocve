import type { Metadata } from "next";

import { Breadcrumb } from "@/components/common/breadcrumb";
import { GlossaryFilter } from "@/components/common/glossary-filter";
import { glossaryTerms } from "@/lib/glossary-data";
import { buildPageMetadata } from "@/utils/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Glosarium Keamanan Siber",
  description: "Penjelasan sederhana untuk 20 istilah keamanan siber yang paling sering ditemui, dalam Bahasa Indonesia.",
  path: "/glossary",
});

export default function GlossaryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <Breadcrumb items={[{ label: "Glosarium" }]} />

      <section aria-labelledby="glossary-title" className="editorial-panel navy-panel -mx-4 mb-10 border-y border-border sm:mx-0 sm:border">
        <div className="relative grid gap-8 px-4 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-end lg:gap-12 lg:px-10 lg:py-12">
          <div className="max-w-4xl">
            <p className="eyebrow mb-5 text-[10px] text-accent">Field guide / Keamanan siber</p>
            <h1 id="glossary-title" className="content-heading font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Istilah siber,<br />
              <span className="text-accent">tanpa bahasa rumit.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Kamus ringkas untuk membaca laporan kerentanan dan memahami istilah yang sering muncul di dunia keamanan digital.
            </p>
          </div>

          <div className="flex items-end justify-between gap-5 border-t border-border pt-5 lg:flex-col lg:items-start lg:justify-end lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <div>
              <p className="data-tag text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Indeks istilah</p>
              <p className="data-tag mt-2 text-6xl font-medium leading-none text-accent">{String(glossaryTerms.length).padStart(2, "0")}</p>
            </div>
            <p className="max-w-28 pb-1 text-xs leading-5 text-muted-foreground">konsep kunci, satu penjelasan dalam satu waktu.</p>
          </div>
        </div>
      </section>

      <GlossaryFilter terms={glossaryTerms} />
    </div>
  );
}
