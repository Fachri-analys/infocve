/**
 * Security utilities for InfoCVE.
 */

/**
 * Validates whether an external URL is safe to render as a clickable link.
 * Only allows 'http:' and 'https:' protocols to prevent XSS via 'javascript:', 'data:', 'file:', etc.
 */
export function isSafeUrl(urlStr?: string): boolean {
  if (!urlStr || typeof urlStr !== "string") return false;
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Safely extracts domain name from a URL, falling back gracefully if invalid.
 */
export function getSafeDomain(urlStr?: string, fallback = "Referensi"): string {
  if (!urlStr || typeof urlStr !== "string") return fallback;
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, "") || fallback;
  } catch {
    return fallback;
  }
}
