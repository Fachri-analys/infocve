import { describe, it, expect } from "vitest";
import { calculatePriority } from "@/lib/priority";

describe("InfoCVE Priority Assessment", () => {
  it("1. P1: assigns Critical / P1 when vulnerability is listed in CISA KEV", () => {
    const assessment = calculatePriority({
      cvss: { baseScore: 7.5, severity: "HIGH" },
      epss: { score: 0.15, percentile: 0.85 },
      cisaKev: { isKev: true },
      hasPoc: false,
    });

    expect(assessment.level).toBe("CRITICAL");
    expect(assessment.tier).toBe("P1");
    expect(assessment.labelId).toContain("P1");
    expect(assessment.factors.inCisaKev).toBe(true);
    expect(assessment.reasons.some((r) => r.includes("CISA KEV"))).toBe(true);
  });

  it("2. P1: assigns Critical / P1 for very high EPSS probability and high CVSS without KEV", () => {
    const assessment = calculatePriority({
      cvss: { baseScore: 8.8, severity: "HIGH" },
      epss: { score: 0.45, percentile: 0.98 },
      cisaKev: { isKev: false },
      hasPoc: true,
    });

    expect(assessment.level).toBe("CRITICAL");
    expect(assessment.tier).toBe("P1");
    expect(assessment.reasons.some((r) => r.includes("EPSS sangat tinggi"))).toBe(true);
  });

  it("3. P2: assigns High / P2 for CVSS Critical (>= 9.0) even when not in KEV", () => {
    const assessment = calculatePriority({
      cvss: { baseScore: 9.8, severity: "CRITICAL" },
      epss: { score: 0.02, percentile: 0.25 },
      cisaKev: { isKev: false },
      hasPoc: false,
    });

    expect(assessment.level).toBe("HIGH");
    expect(assessment.tier).toBe("P2");
    expect(assessment.reasons.some((r) => r.includes("Kritis"))).toBe(true);
  });

  it("4. P2: assigns High / P2 for CVSS High with confirmed public PoC", () => {
    const assessment = calculatePriority({
      cvss: { baseScore: 7.5, severity: "HIGH" },
      epss: { score: 0.03, percentile: 0.35 },
      cisaKev: { isKev: false },
      hasPoc: true,
    });

    expect(assessment.level).toBe("HIGH");
    expect(assessment.tier).toBe("P2");
    expect(assessment.reasons.some((r) => r.includes("PoC"))).toBe(true);
  });

  it("5. P3: assigns Medium / P3 for CVSS Medium (4.0 - 6.9)", () => {
    const assessment = calculatePriority({
      cvss: { baseScore: 5.3, severity: "MEDIUM" },
      epss: { score: 0.01, percentile: 0.2 },
      cisaKev: { isKev: false },
      hasPoc: false,
    });

    expect(assessment.level).toBe("MEDIUM");
    expect(assessment.tier).toBe("P3");
    expect(assessment.reasons.some((r) => r.includes("menengah"))).toBe(true);
  });

  it("6. P3: elevates low CVSS to P3 when public PoC is detected", () => {
    const assessment = calculatePriority({
      cvss: { baseScore: 3.5, severity: "LOW" },
      epss: { score: 0.01, percentile: 0.1 },
      cisaKev: { isKev: false },
      hasPoc: true,
    });

    expect(assessment.level).toBe("MEDIUM");
    expect(assessment.tier).toBe("P3");
    expect(assessment.reasons.some((r) => r.includes("PoC"))).toBe(true);
  });

  it("7. P4: assigns Low / P4 for low CVSS, low EPSS, and no PoC/KEV", () => {
    const assessment = calculatePriority({
      cvss: { baseScore: 2.5, severity: "LOW" },
      epss: { score: 0.005, percentile: 0.05 },
      cisaKev: { isKev: false },
      hasPoc: false,
    });

    expect(assessment.level).toBe("LOW");
    expect(assessment.tier).toBe("P4");
  });

  it("8. Graceful degradation: handles missing EPSS and missing KEV without failing", () => {
    const assessment = calculatePriority({
      cvss: { baseScore: 9.1, severity: "CRITICAL" },
      epss: null,
      cisaKev: null,
      hasPoc: false,
    });

    expect(assessment.level).toBe("HIGH");
    expect(assessment.tier).toBe("P2");
    expect(assessment.factors.inCisaKev).toBe(false);
    expect(assessment.factors.epssScore).toBeUndefined();
    expect(assessment.reasons.some((r) => r.includes("Data EPSS belum tersedia"))).toBe(true);
  });

  it("9. Graceful degradation: handles missing CVSS score when CISA KEV is active", () => {
    const assessment = calculatePriority({
      cvss: undefined,
      epss: { score: 0.05, percentile: 0.5 },
      cisaKev: { isKev: true },
      hasPoc: false,
    });

    expect(assessment.level).toBe("CRITICAL");
    expect(assessment.tier).toBe("P1");
  });

  it("10. Disclaimer check: explicitly designates assessment as non-official guidance", () => {
    const assessment = calculatePriority({
      cvss: { baseScore: 5.0, severity: "MEDIUM" },
    });

    expect(assessment.disclaimer).toBeTruthy();
    expect(assessment.disclaimer).toContain("bukan merupakan standar resmi");
  });

  it("11. Immutability: does not mutate input object or original metric values", () => {
    const input = {
      cvss: { baseScore: 7.8, severity: "HIGH" as const },
      epss: { score: 0.12, percentile: 0.82 },
      cisaKev: { isKev: false },
      hasPoc: false,
    };

    const cloneBefore = JSON.parse(JSON.stringify(input));
    calculatePriority(input);

    expect(input).toEqual(cloneBefore);
  });
});
