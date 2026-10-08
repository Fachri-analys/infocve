import type { Metadata } from "next";

import { SITE_NAME } from "@/utils/constants";

interface PageMetadataInput {
  title: string;
  description: string;
  /** Path starting with "/", e.g. "/about" — used for the canonical URL. */
  path: string;
  type?: "website" | "article";
  keywords?: string[];
}

/**
 * Builds a consistent per-page `Metadata` object, including matching
 * OpenGraph/Twitter titles, canonical URL, and card settings.
 */
export function buildPageMetadata({
  title,
  description,
  path,
  type = "website",
  keywords,
}: PageMetadataInput): Metadata {
  const fullTitle = `${title} | ${SITE_NAME}`;
  return {
    title,
    description,
    keywords,
    alternates: { canonical: path },
    openGraph: {
      type,
      title: fullTitle,
      description,
      siteName: SITE_NAME,
      locale: "id_ID",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
  };
}
