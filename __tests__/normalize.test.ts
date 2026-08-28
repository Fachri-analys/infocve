import { describe, expect, it } from "vitest";
import { normalizeNvdCve } from "@/lib/nvd-normalize";
import type { NvdCveRecord } from "@/lib/nvd-types";

describe("Vulnerability Normalization (normalizeNvdCve)", () => {
  it("normalizes CVSS v4.0 correctly with priority over older versions", () => {
    const raw: NvdCveRecord = {
      id: "CVE-2024-12345",
      published: "2024-05-01T10:00:00.000",
      lastModified: "2024-05-02T12:00:00.000",
      descriptions: [{ lang: "en", value: "A critical CVSS v4.0 flaw in Example Engine." }],
      metrics: {
        cvssMetricV40: [
          {
            type: "Primary",
            cvssData: {
              version: "4.0",
              vectorString: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
              baseScore: 9.3,
              baseSeverity: "CRITICAL",
              attackVector: "NETWORK",
              attackComplexity: "LOW",
              attackRequirements: "NONE",
              privilegesRequired: "NONE",
              userInteraction: "NONE",
              vulnerableSystemConfidentiality: "HIGH",
              vulnerableSystemIntegrity: "HIGH",
              vulnerableSystemAvailability: "HIGH",
              subsequentSystemConfidentiality: "NONE",
              subsequentSystemIntegrity: "NONE",
              subsequentSystemAvailability: "NONE",
            },
          },
        ],
        cvssMetricV31: [
          {
            type: "Primary",
            cvssData: {
              version: "3.1",
              vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
              baseScore: 9.8,
              baseSeverity: "CRITICAL",
              attackVector: "NETWORK",
              attackComplexity: "LOW",
              privilegesRequired: "NONE",
              userInteraction: "NONE",
              scope: "UNCHANGED",
              confidentialityImpact: "HIGH",
              integrityImpact: "HIGH",
              availabilityImpact: "HIGH",
            },
          },
        ],
      },
    };

    const result = normalizeNvdCve(raw);
    expect(result.id).toBe("CVE-2024-12345");
    expect(result.cvss.version).toBe("4.0");
    expect(result.cvss.baseScore).toBe(9.3);
    expect(result.cvss.severity).toBe("CRITICAL");
    expect(result.cvss.attackRequirements).toBe("NONE");
    expect(result.cvss.vulnerableSystemImpact?.confidentiality).toBe("HIGH");
    expect(result.cvss.subsequentSystemImpact?.confidentiality).toBe("NONE");
  });

  it("normalizes CVSS v3.1 when v4.0 is not present", () => {
    const raw: NvdCveRecord = {
      id: "CVE-2023-9999",
      published: "2023-01-01T00:00:00.000",
      lastModified: "2023-01-02T00:00:00.000",
      descriptions: [{ lang: "en", value: "Memory leak in Linux Kernel." }],
      metrics: {
        cvssMetricV31: [
          {
            type: "Primary",
            cvssData: {
              version: "3.1",
              vectorString: "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:H",
              baseScore: 7.1,
              baseSeverity: "HIGH",
              attackVector: "LOCAL",
              attackComplexity: "LOW",
              privilegesRequired: "LOW",
              userInteraction: "NONE",
              scope: "UNCHANGED",
              confidentialityImpact: "HIGH",
              integrityImpact: "NONE",
              availabilityImpact: "HIGH",
            },
          },
        ],
      },
    };

    const result = normalizeNvdCve(raw);
    expect(result.cvss.version).toBe("3.1");
    expect(result.cvss.baseScore).toBe(7.1);
    expect(result.cvss.severity).toBe("HIGH");
    expect(result.cvss.attackVector).toBe("LOCAL");
  });

  it("normalizes CVSS v2.0 correctly as fallback", () => {
    const raw: NvdCveRecord = {
      id: "CVE-2010-1234",
      published: "2010-05-05T00:00:00.000",
      lastModified: "2010-05-06T00:00:00.000",
      descriptions: [{ lang: "en", value: "Buffer overflow in legacy service." }],
      metrics: {
        cvssMetricV2: [
          {
            type: "Primary",
            baseSeverity: "HIGH",
            cvssData: {
              version: "2.0",
              vectorString: "AV:N/AC:L/Au:N/C:P/I:P/A:P",
              baseScore: 7.5,
            },
          },
        ],
      },
    };

    const result = normalizeNvdCve(raw);
    expect(result.cvss.version).toBe("2.0");
    expect(result.cvss.baseScore).toBe(7.5);
    expect(result.cvss.severity).toBe("HIGH");
    expect(result.cvss.attackVector).toBe("NETWORK");
  });

  it("handles CVE without CVSS score (unscored/awaiting analysis)", () => {
    const raw: NvdCveRecord = {
      id: "CVE-2026-0001",
      published: "2026-08-01T00:00:00.000",
      lastModified: "2026-08-01T00:00:00.000",
      descriptions: [{ lang: "en", value: "Newly submitted CVE awaiting analysis." }],
    };

    const result = normalizeNvdCve(raw);
    expect(result.cvss.baseScore).toBe(0);
    expect(result.cvss.severity).toBe("NONE");
    expect(result.cvss.vectorString).toBe("Belum dinilai oleh NVD");
  });

  it("extracts CWE and catalog details", () => {
    const raw: NvdCveRecord = {
      id: "CVE-2024-7777",
      published: "2024-01-01T00:00:00.000",
      lastModified: "2024-01-01T00:00:00.000",
      descriptions: [{ lang: "en", value: "Cross-site scripting flaw." }],
      weaknesses: [
        {
          description: [
            { lang: "en", value: "CWE-79" },
            { lang: "en", value: "CWE-89" },
          ],
        },
      ],
    };

    const result = normalizeNvdCve(raw);
    expect(result.cwe.length).toBe(2);
    expect(result.cwe[0]?.id).toBe("CWE-79");
    expect(result.cwe[0]?.name).toContain("Cross-Site Scripting");
    expect(result.cwe[1]?.id).toBe("CWE-89");
  });

  it("parses CPE configurations into vendor and product", () => {
    const raw: NvdCveRecord = {
      id: "CVE-2024-8888",
      published: "2024-01-01T00:00:00.000",
      lastModified: "2024-01-01T00:00:00.000",
      descriptions: [{ lang: "en", value: "Vulnerability in Apache Tomcat." }],
      configurations: [
        {
          nodes: [
            {
              cpeMatch: [
                {
                  vulnerable: true,
                  criteria: "cpe:2.3:a:apache:tomcat:10.1.0:*:*:*:*:*:*:*",
                  versionStartIncluding: "10.1.0",
                  versionEndExcluding: "10.1.15",
                },
              ],
            },
          ],
        },
      ],
    };

    const result = normalizeNvdCve(raw);
    expect(result.vendor).toBe("Apache");
    expect(result.product).toBe("Tomcat");
    expect(result.affected.length).toBe(1);
    expect(result.affected[0]?.versions[0]).toBe(">= 10.1.0, < 10.1.15");
  });

  it("infers category based on CWE and CPE", () => {
    const raw: NvdCveRecord = {
      id: "CVE-2024-5555",
      published: "2024-01-01T00:00:00.000",
      lastModified: "2024-01-01T00:00:00.000",
      descriptions: [{ lang: "en", value: "OS Kernel memory corruption." }],
      configurations: [
        {
          nodes: [
            {
              cpeMatch: [
                {
                  vulnerable: true,
                  criteria: "cpe:2.3:o:linux:linux_kernel:6.1:*:*:*:*:*:*:*",
                },
              ],
            },
          ],
        },
      ],
    };

    const result = normalizeNvdCve(raw);
    expect(result.category).toBe("operating-system");
  });
});
