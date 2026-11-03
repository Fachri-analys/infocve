import { describe, expect, it, vi } from "vitest";
import { applyCnaFallback, fillMissingCveEntities } from "@/lib/cve/cna-fallback";
import type { CVE } from "@/types/cve";

const baseCve: CVE = {
  id: "CVE-2024-12345", title: "Example", year: 2024, publishedDate: "2024-01-01T00:00:00Z",
  lastModifiedDate: "2024-01-02T00:00:00Z", descriptionEn: "Description", descriptionId: "",
  translationStatus: "PENDING", vendor: "Unknown Vendor", product: "Unknown Product", category: "unclassified",
  cvss: null, cwe: [], affected: [], references: [], sources: ["NVD"],
};

describe("CVE Program CNA fallback", () => {
  it("uses real CNA vendor/product and retains the source reference", () => {
    const result = applyCnaFallback(baseCve, {
      containers: { cna: { affected: [{ vendor: "Example Inc.", product: "Widget", versions: [{ version: "1.0", status: "affected" }, { version: "2.0", status: "unaffected" }] }] } },
    });
    expect(result.vendor).toBe("Example Inc.");
    expect(result.product).toBe("Widget");
    expect(result.affected).toEqual([{ vendor: "Example Inc.", product: "Widget", versions: ["1.0"] }]);
    expect(result.references.at(-1)?.url).toBe("https://cveawg.mitre.org/api/cve/CVE-2024-12345");
    expect(result.sources).toContain("CNA");
  });

  it("keeps existing entities when the external CNA request fails", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("network failure"));
    await expect(fillMissingCveEntities(baseCve, fetcher)).resolves.toEqual(baseCve);
  });
});
