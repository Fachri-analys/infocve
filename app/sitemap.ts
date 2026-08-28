import type { MetadataRoute } from "next";

import { getLatestCVEs } from "@/lib/nvd";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// With live NVD data there are 200,000+ CVEs — far too many (and far too
// dynamic) to enumerate in a sitemap, and sitemaps were never meant to list
// every page of a large, ever-growing catalog anyway. Search engines find
// individual CVE pages by crawling the links on /search results instead;
// this sitemap includes only the static routes plus a small, recent sample
// so there's still at least one crawlable path into /cve/[id].
const RECENT_CVE_SAMPLE_SIZE = 30;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/search`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/sources`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/glossary`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/about`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // getLatestCVEs() never throws (see lib/nvd.ts) — if NVD is unreachable
  // this simply returns [], and the sitemap still builds with just the
  // static routes above.
  const recent = await getLatestCVEs(RECENT_CVE_SAMPLE_SIZE);
  const cveRoutes: MetadataRoute.Sitemap = recent.map((cve) => ({
    url: `${siteUrl}/cve/${cve.id}`,
    lastModified: cve.lastModifiedDate,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...cveRoutes];
}
