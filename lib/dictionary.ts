import type { DictionaryEntry } from "@/types";

/**
 * Dictionary-based translation — deliberately NOT AI-generated (see project
 * brief, Step 11). This is a plain lookup table of common cybersecurity
 * terms to short Indonesian labels + one-line explanations. Technical names
 * themselves are never translated/renamed, only explained, so a term like
 * "SQL Injection" always still reads as "SQL Injection" in the UI.
 *
 * Used directly by `lib/nvd-normalize.ts` to build the dictionary-assisted
 * Indonesian summary for real NVD descriptions (see docs/API_INTEGRATION.md
 * §6) — this is the actual mechanism behind that, not just glossary content.
 */
export const termDictionary: Record<string, DictionaryEntry> = {
  "remote-code-execution": {
    term: "Remote Code Execution",
    id: "Eksekusi Kode Jarak Jauh",
    description: "Penyerang bisa menjalankan kode/perintah dari jarak jauh di sistem korban.",
  },
  "sql-injection": {
    term: "SQL Injection",
    id: "Injeksi SQL",
    description: "Penyerang menyisipkan perintah SQL berbahaya lewat input aplikasi untuk memanipulasi basis data.",
  },
  xss: {
    term: "Cross-Site Scripting (XSS)",
    id: "Skrip Lintas Situs",
    description: "Penyerang menyisipkan skrip berbahaya ke halaman web yang akan dilihat pengguna lain.",
  },
  csrf: {
    term: "Cross-Site Request Forgery (CSRF)",
    id: "Pemalsuan Permintaan Lintas Situs",
    description: "Penyerang mengelabui pengguna yang sudah login agar tanpa sadar mengirim aksi yang tidak diinginkan.",
  },
  ssrf: {
    term: "Server-Side Request Forgery (SSRF)",
    id: "Pemalsuan Permintaan Sisi Server",
    description: "Penyerang membuat server korban mengirim permintaan ke lokasi yang seharusnya tidak bisa diakses.",
  },
  "path-traversal": {
    term: "Path Traversal",
    id: "Penjelajahan Direktori",
    description: 'Penyerang memanipulasi alamat berkas (misalnya dengan "../") untuk mengakses berkas di luar folder yang diizinkan.',
  },
  "authentication-bypass": {
    term: "Authentication Bypass",
    id: "Melewati Proses Autentikasi",
    description: "Penyerang berhasil melewati proses verifikasi identitas tanpa kredensial yang sah.",
  },
  "privilege-escalation": {
    term: "Privilege Escalation",
    id: "Eskalasi Hak Akses",
    description: "Penyerang memperoleh hak akses yang lebih tinggi dari yang semestinya dimiliki.",
  },
  "file-upload": {
    term: "File Upload Vulnerability",
    id: "Kerentanan Unggah Berkas",
    description: "Celah pada fitur unggah berkas yang memungkinkan penyerang mengunggah berkas berbahaya ke server.",
  },
  "information-disclosure": {
    term: "Information Disclosure",
    id: "Kebocoran Informasi",
    description: "Sistem secara tidak sengaja membuka atau membocorkan data yang seharusnya bersifat rahasia.",
  },
  "broken-access-control": {
    term: "Broken Access Control",
    id: "Kontrol Akses yang Rusak",
    description: "Sistem gagal membatasi apa yang boleh dilihat atau dilakukan pengguna sesuai hak aksesnya.",
  },
  "security-misconfiguration": {
    term: "Security Misconfiguration",
    id: "Kesalahan Konfigurasi Keamanan",
    description: "Sistem berjalan dengan pengaturan keamanan yang lemah, longgar, atau masih bawaan (default).",
  },
};
