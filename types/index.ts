import type { CVECategory } from "./cve";

export * from "./cve";

export interface NavLink {
  href: string;
  label: string;
}

export interface GlossaryTerm {
  slug: string;
  term: string;
  abbreviation?: string;
  definitionId: string;
}

export interface DictionaryEntry {
  term: string;
  id: string;
  description?: string;
}

export interface SecurityCategory {
  slug: CVECategory;
  name: string;
  descriptionId: string;
}
