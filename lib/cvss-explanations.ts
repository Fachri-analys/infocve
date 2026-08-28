import type {
  AttackComplexity,
  AttackVector,
  ImpactValue,
  PrivilegesRequired,
  ScopeValue,
  UserInteraction,
} from "@/types/cve";

/**
 * Beginner-friendly Indonesian explanations for each possible CVSS v3.x
 * metric value, used by <CVSSCard> so a newcomer can read a vector string
 * like "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" as plain sentences instead of
 * memorizing the spec.
 */

export const attackVectorLabel: Record<AttackVector, { label: string; explanation: string }> = {
  NETWORK: { label: "Jaringan", explanation: "Bisa dieksploitasi dari jarak jauh lewat jaringan/internet, tanpa akses fisik ke perangkat." },
  ADJACENT_NETWORK: { label: "Jaringan Lokal", explanation: "Penyerang harus berada di jaringan lokal yang sama (misalnya satu Wi-Fi) dengan target." },
  LOCAL: { label: "Lokal", explanation: "Penyerang perlu akses lokal ke sistem, misalnya lewat akun pengguna biasa atau membuka berkas tertentu." },
  PHYSICAL: { label: "Fisik", explanation: "Penyerang harus memiliki akses fisik langsung ke perangkat, misalnya menyentuh atau mencolokkan sesuatu ke perangkat." },
};

export const attackComplexityLabel: Record<AttackComplexity, { label: string; explanation: string }> = {
  LOW: { label: "Rendah", explanation: "Tidak butuh kondisi khusus — penyerang bisa mengeksploitasi celah ini secara konsisten dan berulang." },
  HIGH: { label: "Tinggi", explanation: "Butuh kondisi atau persiapan khusus di luar kendali penyerang agar eksploitasi berhasil." },
};

export const privilegesRequiredLabel: Record<PrivilegesRequired, { label: string; explanation: string }> = {
  NONE: { label: "Tidak Ada", explanation: "Penyerang tidak perlu login atau memiliki akun apa pun untuk mengeksploitasi celah ini." },
  LOW: { label: "Rendah", explanation: "Penyerang hanya perlu akun dengan hak akses dasar/biasa, bukan admin." },
  HIGH: { label: "Tinggi", explanation: "Penyerang perlu hak akses tingkat tinggi (misalnya admin) sebelum bisa mengeksploitasi celah ini." },
};

export const attackRequirementsLabel: Record<"NONE" | "PRESENT", { label: string; explanation: string }> = {
  NONE: { label: "Tidak Ada", explanation: "Tidak ada prasyarat khusus pada sistem target untuk mengeksploitasi celah ini." },
  PRESENT: { label: "Ada Prasyarat", explanation: "Diperlukan kondisi atau konfigurasi sistem khusus pada target." },
};

export const userInteractionLabel: Record<UserInteraction, { label: string; explanation: string }> = {
  NONE: { label: "Tidak Perlu", explanation: "Eksploitasi berjalan tanpa perlu ada tindakan apa pun dari korban." },
  REQUIRED: { label: "Diperlukan", explanation: "Korban harus melakukan sesuatu terlebih dahulu, misalnya mengklik tautan atau membuka berkas." },
  PASSIVE: { label: "Pasif", explanation: "Korban melakukan interaksi pasif (misalnya mengunjungi halaman terinfeksi)." },
  ACTIVE: { label: "Aktif", explanation: "Korban harus secara aktif melakukan tindakan spesifik yang disengaja." },
};

export const scopeLabel: Record<ScopeValue, { label: string; explanation: string }> = {
  UNCHANGED: { label: "Tidak Berubah", explanation: "Dampak kerentanan terbatas pada komponen yang rentan itu sendiri." },
  CHANGED: { label: "Berubah", explanation: "Dampak kerentanan bisa menyebar ke komponen lain di luar yang rentan." },
  NOT_DEFINED: { label: "Tidak Didefinisikan", explanation: "Dimensi scope tidak digunakan pada versi scoring ini." },
};

export const impactLabel: Record<ImpactValue, { label: string; explanation: string }> = {
  NONE: { label: "Tidak Ada", explanation: "Tidak ada dampak pada aspek ini." },
  LOW: { label: "Rendah", explanation: "Ada dampak, tetapi terbatas atau sebagian." },
  HIGH: { label: "Tinggi", explanation: "Dampaknya besar dan menyeluruh pada aspek ini." },
};

export const cvssMetricInfo = {
  confidentiality: {
    label: "Kerahasiaan",
    description: "Seberapa besar data rahasia bisa terekspos ke pihak yang tidak berhak.",
  },
  integrity: {
    label: "Integritas",
    description: "Seberapa besar data bisa diubah atau dirusak tanpa izin.",
  },
  availability: {
    label: "Ketersediaan",
    description: "Seberapa besar layanan bisa dibuat tidak bisa diakses atau berhenti berfungsi.",
  },
};
