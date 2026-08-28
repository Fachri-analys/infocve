import type { Metadata } from "next";

import { SITE_NAME } from "@/utils/constants";

interface PageMetadataInput {
  title: string;
  description: string;
  /** Path starting with "/", e.g. "/about" — used for the canonical URL. */
  path: string;
}

/**
 * Builds a consistent per-page `Metadata` object, including matching
 * OpenGraph/Twitter titles.
 *
 * Without this, a page that only sets `title`/`description` silently
 * inherits the ROOT layout's `openGraph`/`twitter` blocks wholesale
 * (Next.js does not merge them field-by-field) — so sharing, say, `/about`
 * would show the homepage's title and description in the social preview
 * card instead of the About page's own. The root layout's `title` template
 * (`%s | InfoCVE`) already applies automatically to the plain `<title>`
 * tag, but OpenGraph/Twitter titles need it applied manually since they
 * aren't covered by that template mechanism.
 */
export function buildPageMetadata({ title, description, path }: PageMetadataInput): Metadata {
  const fullTitle = `${title} | ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: fullTitle, description },
    twitter: { title: fullTitle, description },
  };
}
