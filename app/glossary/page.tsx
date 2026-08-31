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
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <Breadcrumb items={[{ label: "Glosarium" }]} />

      <div className="page-intro">
        <p className="eyebrow mb-3 text-[10px]">Belajar dengan bahasa sederhana</p>
        <h1 className="content-heading font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">Glosarium Keamanan Siber</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {glossaryTerms.length} istilah keamanan siber yang paling sering muncul, dijelaskan dengan bahasa sederhana.
        Ketuk salah satu istilah untuk membaca penjelasan lengkapnya.
      </p>
      </div>

      <div className="mt-8">
        <GlossaryFilter terms={glossaryTerms} />
      </div>
    </div>
  );
}
