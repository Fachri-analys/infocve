import { describe, expect, it } from "vitest";
import { isValidCalendarDate } from "@/app/search/page";
import type { CVE } from "@/types/cve";

describe("Search & Date Validation", () => {
  describe("isValidCalendarDate", () => {
    it("validates valid dates correctly", () => {
      expect(isValidCalendarDate("2024-02-29")).toBe(true); // Leap year
      expect(isValidCalendarDate("2026-08-11")).toBe(true);
      expect(isValidCalendarDate("2023-12-31")).toBe(true);
    });

    it("rejects invalid calendar dates", () => {
      expect(isValidCalendarDate("2026-02-31")).toBe(false); // Non-existent date
      expect(isValidCalendarDate("2023-02-29")).toBe(false); // Non-leap year Feb 29
      expect(isValidCalendarDate("2026-13-01")).toBe(false); // Month 13
      expect(isValidCalendarDate("2026-00-10")).toBe(false); // Month 0
      expect(isValidCalendarDate("invalid")).toBe(false);
      expect(isValidCalendarDate("2026/08/11")).toBe(false);
    });
  });

  describe("Sorting and Filtering logic", () => {
    const mockCVEs: CVE[] = [
      {
        id: "CVE-2024-0001",
        title: "High score old date",
        year: 2024,
        publishedDate: "2024-01-01T00:00:00.000Z",
        lastModifiedDate: "2024-01-05T00:00:00.000Z",
        descriptionEn: "Test description 1",
        descriptionId: "Test id 1",
        cvss: {
          version: "3.1",
          baseScore: 9.8,
          severity: "CRITICAL",
          vectorString: "CVSS:3.1/...",
          attackVector: "NETWORK",
          attackComplexity: "LOW",
          privilegesRequired: "NONE",
          userInteraction: "NONE",
          scope: "UNCHANGED",
          confidentialityImpact: "HIGH",
          integrityImpact: "HIGH",
          availabilityImpact: "HIGH",
        },
        cwe: [{ id: "CWE-79", name: "XSS" }],
        vendor: "VendorA",
        product: "ProductA",
        affected: [],
        references: [],
        category: "web-application",
      },
      {
        id: "CVE-2024-0002",
        title: "Medium score new date",
        year: 2024,
        publishedDate: "2024-06-01T00:00:00.000Z",
        lastModifiedDate: "2024-06-02T00:00:00.000Z",
        descriptionEn: "Test description 2",
        descriptionId: "Test id 2",
        cvss: {
          version: "3.1",
          baseScore: 5.3,
          severity: "MEDIUM",
          vectorString: "CVSS:3.1/...",
          attackVector: "NETWORK",
          attackComplexity: "LOW",
          privilegesRequired: "NONE",
          userInteraction: "REQUIRED",
          scope: "UNCHANGED",
          confidentialityImpact: "LOW",
          integrityImpact: "LOW",
          availabilityImpact: "NONE",
        },
        cwe: [{ id: "CWE-89", name: "SQLi" }],
        vendor: "VendorB",
        product: "ProductB",
        affected: [],
        references: [],
        category: "enterprise-software",
      },
    ];

    it("sorts by baseScore descending", () => {
      const sorted = [...mockCVEs].sort((a, b) => b.cvss.baseScore - a.cvss.baseScore);
      expect(sorted[0]?.id).toBe("CVE-2024-0001");
      expect(sorted[1]?.id).toBe("CVE-2024-0002");
    });

    it("sorts by publishedDate descending", () => {
      const sorted = [...mockCVEs].sort(
        (a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime()
      );
      expect(sorted[0]?.id).toBe("CVE-2024-0002");
      expect(sorted[1]?.id).toBe("CVE-2024-0001");
    });
  });
});
