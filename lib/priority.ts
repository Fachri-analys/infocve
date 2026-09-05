import type { PriorityAssessment, PriorityLevel, Severity } from "@/types/cve";

const PRIORITY_DISCLAIMER =
  "InfoCVE Priority adalah panduan triase internal deterministik berdasarkan kombinasi CVSS, EPSS, dan CISA KEV. Metodologi ini bukan merupakan standar resmi pengganti metriks asli.";

export interface PriorityInput {
  cvss?: {
    baseScore?: number;
    severity?: Severity;
  };
  epss?: {
    score?: number;
    percentile?: number;
  } | null;
  cisaKev?: {
    isKev?: boolean;
  } | null;
  hasPoc?: boolean;
}

/**
 * Deterministic heuristic priority calculation for InfoCVE.
 * Synthesizes CVSS (technical severity), EPSS (statistical exploitation probability),
 * and CISA KEV (confirmed real-world catalog entry) into a transparent triage guide.
 */
export function calculatePriority(cve: PriorityInput): PriorityAssessment {
  const inCisaKev = Boolean(cve.cisaKev?.isKev);
  const cvssScore =
    typeof cve.cvss?.baseScore === "number" && !isNaN(cve.cvss.baseScore) ? cve.cvss.baseScore : undefined;
  const cvssSeverity = cve.cvss?.severity;
  const epssScore =
    typeof cve.epss?.score === "number" && !isNaN(cve.epss.score) ? cve.epss.score : undefined;
  const epssPercentile =
    typeof cve.epss?.percentile === "number" && !isNaN(cve.epss.percentile) ? cve.epss.percentile : undefined;
  const hasPoc = Boolean(cve.hasPoc);

  const reasons: string[] = [];

  // Classification flags
  const isCvssCritical = cvssScore !== undefined ? cvssScore >= 9.0 : cvssSeverity === "CRITICAL";
  const isCvssHigh = cvssScore !== undefined ? cvssScore >= 7.0 : cvssSeverity === "HIGH" || isCvssCritical;
  const isCvssMedium =
    cvssScore !== undefined ? cvssScore >= 4.0 && cvssScore < 7.0 : cvssSeverity === "MEDIUM";

  const isEpssVeryHigh =
    epssScore !== undefined && epssPercentile !== undefined
      ? epssScore >= 0.3 || epssPercentile >= 0.95
      : epssScore !== undefined
        ? epssScore >= 0.3
        : false;

  const isEpssHigh =
    epssScore !== undefined && epssPercentile !== undefined
      ? epssScore >= 0.1 || epssPercentile >= 0.8
      : epssScore !== undefined
        ? epssScore >= 0.1
        : false;

  const isEpssModerate =
    epssScore !== undefined && epssPercentile !== undefined
      ? epssScore >= 0.05 || epssPercentile >= 0.5
      : epssScore !== undefined
        ? epssScore >= 0.05
        : false;

  let level: PriorityLevel;
  let tier: "P1" | "P2" | "P3" | "P4";
  let labelId: string;

  // Deterministic Decision Tree
  // Tier 1: P1 - Sangat Mendesak
  if (inCisaKev) {
    level = "CRITICAL";
    tier = "P1";
    labelId = "Sangat Mendesak (P1)";
    reasons.push("Tercantum dalam katalog CISA KEV (telah terbukti pernah dieksploitasi di alam liar).");
    if (cvssScore !== undefined) {
      reasons.push(`Dampak teknis CVSS bernilai ${cvssScore.toFixed(1)} (${cvssSeverity || "Terdokumentasi"}).`);
    }
    if (epssScore !== undefined) {
      reasons.push(`Probabilitas eksploitasi EPSS ${(epssScore * 100).toFixed(2)}%.`);
    }
  } else if (isEpssVeryHigh && isCvssHigh) {
    level = "CRITICAL";
    tier = "P1";
    labelId = "Sangat Mendesak (P1)";
    reasons.push(
      `Probabilitas eksploitasi EPSS sangat tinggi (${(epssScore! * 100).toFixed(2)}%, persentil ${(epssPercentile! * 100).toFixed(1)}%).`
    );
    reasons.push(
      `Dampak teknis CVSS tergolong tinggi/kritis (${cvssScore !== undefined ? cvssScore.toFixed(1) : cvssSeverity}).`
    );
    if (hasPoc) {
      reasons.push("Tersedia bukti konsep eksploitasi (PoC) pada referensi publik.");
    }
  }
  // Tier 2: P2 - Prioritas Tinggi
  else if (isCvssCritical) {
    level = "HIGH";
    tier = "P2";
    labelId = "Prioritas Tinggi (P2)";
    reasons.push(
      `Tingkat keparahan teknis CVSS berada pada level Kritis (${cvssScore !== undefined ? cvssScore.toFixed(1) : "CRITICAL"}).`
    );
    if (epssScore !== undefined) {
      reasons.push(`Probabilitas eksploitasi EPSS ${(epssScore * 100).toFixed(2)}%.`);
    } else {
      reasons.push("Data EPSS belum tersedia untuk mengukur probabilitas eksploitasi di dunia nyata.");
    }
    reasons.push("Belum tercantum dalam katalog eksploitasi CISA KEV.");
  } else if (isCvssHigh && (hasPoc || isEpssHigh)) {
    level = "HIGH";
    tier = "P2";
    labelId = "Prioritas Tinggi (P2)";
    reasons.push(`Dampak teknis CVSS tergolong tinggi (${cvssScore !== undefined ? cvssScore.toFixed(1) : "HIGH"}).`);
    if (isEpssHigh) {
      reasons.push(
        `Probabilitas eksploitasi EPSS tinggi (${(epssScore! * 100).toFixed(2)}%, persentil ${(epssPercentile! * 100).toFixed(1)}%).`
      );
    }
    if (hasPoc) {
      reasons.push("Tersedia bukti konsep eksploitasi (PoC) pada referensi publik.");
    }
    reasons.push("Belum tercantum dalam katalog eksploitasi CISA KEV.");
  } else if (isCvssHigh) {
    level = "HIGH";
    tier = "P2";
    labelId = "Prioritas Tinggi (P2)";
    reasons.push(`Dampak teknis CVSS tergolong tinggi (${cvssScore !== undefined ? cvssScore.toFixed(1) : "HIGH"}).`);
    if (epssScore !== undefined) {
      reasons.push(`Probabilitas eksploitasi EPSS relatif rendah (${(epssScore * 100).toFixed(2)}%).`);
    } else {
      reasons.push("Data EPSS belum tersedia saat evaluasi.");
    }
    reasons.push("Tidak ada catatan eksploitasi di CISA KEV dan belum ada PoC publik yang terkonfirmasi.");
  }
  // Tier 3: P3 - Prioritas Menengah
  else if (isCvssMedium || isEpssModerate || hasPoc) {
    level = "MEDIUM";
    tier = "P3";
    labelId = "Prioritas Menengah (P3)";
    if (cvssScore !== undefined) {
      reasons.push(`Dampak teknis CVSS tergolong menengah (${cvssScore.toFixed(1)}).`);
    }
    if (isEpssModerate) {
      reasons.push(`Probabilitas eksploitasi EPSS berada di kisaran menengah (${(epssScore! * 100).toFixed(2)}%).`);
    }
    if (hasPoc) {
      reasons.push("Terdapat referensi PoC publik.");
    }
    if (!inCisaKev) {
      reasons.push("Tidak terdaftar dalam CISA KEV.");
    }
  }
  // Tier 4: P4 - Prioritas Rendah
  else {
    level = "LOW";
    tier = "P4";
    labelId = "Prioritas Rendah (P4)";
    if (cvssScore !== undefined) {
      reasons.push(`Dampak teknis CVSS tergolong rendah (${cvssScore.toFixed(1)}).`);
    } else {
      reasons.push("Dampak teknis CVSS belum dinilai atau bernilai rendah.");
    }
    if (epssScore !== undefined) {
      reasons.push(`Probabilitas eksploitasi EPSS rendah (${(epssScore * 100).toFixed(2)}%).`);
    } else {
      reasons.push("Data EPSS tidak tersedia.");
    }
    reasons.push("Tidak tercatat dalam katalog CISA KEV dan tidak ditemukan PoC publik.");
  }

  return {
    level,
    tier,
    labelId,
    reasons,
    factors: {
      inCisaKev,
      cvssScore,
      cvssSeverity,
      epssScore,
      epssPercentile,
      hasPoc,
    },
    disclaimer: PRIORITY_DISCLAIMER,
  };
}
