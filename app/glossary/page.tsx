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
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: "Glosarium" }]} />

      <h1 className="font-display text-2xl font-medium text-foreground sm:text-3xl">Glosarium Keamanan Siber</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {glossaryTerms.length} istilah keamanan siber yang paling sering muncul, dijelaskan dengan bahasa sederhana.
        Ketuk salah satu istilah untuk membaca penjelasan lengkapnya.
      </p>

      <div className="mt-8">
        <GlossaryFilter terms={glossaryTerms} />
      </div>
    </div>
  );
}
