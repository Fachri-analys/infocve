import catalog from "./cwe-catalog.json";

/** MITRE CWE names generated from the Comprehensive View CSV. */
export const CWE_CATALOG: Record<string, string> = catalog;

export function getCweName(id: string): string {
  return CWE_CATALOG[id] ?? id;
}
