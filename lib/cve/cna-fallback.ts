import type { AffectedProduct, CVE } from "@/types/cve";

interface CnaAffectedProduct {
  vendor?: unknown;
  product?: unknown;
  versions?: unknown;
}

function usableName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || /^(n\/a|unknown( vendor| product)?)$/i.test(name)) return null;
  return name;
}

function parseVersions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const version = entry as Record<string, unknown>;
    if (version.status !== "affected") return [];
    const result: string[] = [];
    for (const key of ["version", "lessThan", "lessThanOrEqual"]) {
      if (typeof version[key] === "string" && version[key]) result.push(version[key] as string);
    }
    return result;
  });
}

export function applyCnaFallback(cve: CVE, data: unknown): CVE {
  if (!data || typeof data !== "object" || Array.isArray(data)) return cve;
  const containers = (data as { containers?: unknown }).containers;
  if (!containers || typeof containers !== "object" || Array.isArray(containers)) return cve;
  const cna = (containers as { cna?: unknown }).cna;
  if (!cna || typeof cna !== "object" || Array.isArray(cna)) return cve;
  const record = cna as { affected?: unknown };
  const affected = Array.isArray(record.affected) ? record.affected as CnaAffectedProduct[] : [];
  const valid = affected.filter((entry) => entry && typeof entry === "object");
  const vendor = valid.map((entry) => usableName(entry.vendor)).find(Boolean) ?? null;
  const product = valid.map((entry) => usableName(entry.product)).find(Boolean) ?? null;
  if (!vendor && !product) return cve;

  const sourceAffected: AffectedProduct[] = valid.flatMap((entry) => {
    const entryVendor = usableName(entry.vendor);
    const entryProduct = usableName(entry.product);
    if (!entryVendor || !entryProduct) return [];
    return [{ vendor: entryVendor, product: entryProduct, versions: parseVersions(entry.versions) }];
  });
  const recordUrl = `https://cveawg.mitre.org/api/cve/${encodeURIComponent(cve.id)}`;
  const references = cve.references.some((reference) => reference.url === recordUrl)
    ? cve.references
    : [...cve.references, { url: recordUrl, source: "CVE Program CNA record", tags: ["CNA Record"] }];
  const sources = [...new Set([...(cve.sources ?? ["NVD"]), "CNA"])];

  return {
    ...cve,
    vendor: usableName(cve.vendor) ?? vendor ?? "Unknown Vendor",
    product: usableName(cve.product) ?? product ?? "Unknown Product",
    affected: cve.affected.length > 0 ? cve.affected : sourceAffected,
    references,
    sources,
  };
}

export async function fillMissingCveEntities(cve: CVE, fetcher: typeof fetch = fetch, timeoutMs = 5000): Promise<CVE> {
  const needsVendor = !usableName(cve.vendor);
  const needsProduct = !usableName(cve.product);
  if (!needsVendor && !needsProduct) return cve;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const response = await fetcher(`https://cveawg.mitre.org/api/cve/${encodeURIComponent(cve.id)}`, {
      headers: { Accept: "application/json", "User-Agent": "InfoCVE/0.1.0" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return cve;
    return applyCnaFallback(cve, await response.json());
  } catch {
    return cve;
  } finally {
    clearTimeout(timeout);
  }
}
