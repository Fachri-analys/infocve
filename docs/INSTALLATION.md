# Panduan Instalasi

## Prasyarat

- Node.js 20.9 atau lebih baru — versi ini dipatok lewat field `engines` di `package.json`
- npm (proyek ini memakai npm; lockfile-nya adalah `package-lock.json`)

## Langkah-langkah

```bash
# 1. Masuk ke folder proyek
cd infocve

# 2. Pasang dependency
npm install

# 3. Salin berkas environment variable
cp .env.example .env.local
# lalu sesuaikan NEXT_PUBLIC_SITE_URL bila perlu

# 4. Jalankan server pengembangan
npm run dev
```

Buka <http://localhost:3000> di browser.

## Skrip yang Tersedia

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Menjalankan server pengembangan (Turbopack) |
| `npm run build` | Build produksi |
| `npm run start` | Menjalankan hasil build produksi secara lokal |
| `npm run lint` | Menjalankan ESLint |

## Struktur Folder

```
app/         Rute halaman (App Router) — homepage, /search, /cve/[id], dst.
components/  Komponen UI, dikelompokkan per domain (ui, layout, cve, search, common)
lib/         Layanan data & logika domain (lib/nvd.ts + nvd-client/nvd-normalize/nvd-types.ts, dictionary.ts)
types/       Tipe TypeScript bersama
utils/       Fungsi bantu generik (format tanggal, konstanta, dsb.)
hooks/       Custom React hooks
styles/      globals.css — token desain & gaya global
docs/        Dokumen ini dan panduan lainnya
```

## Masalah Umum

- **Font:** Proyek ini memakai paket `@fontsource/*` (Space Grotesk, Plus
  Jakarta Sans, JetBrains Mono) yang menyertakan berkas font langsung di
  `node_modules` — bukan `next/font/google`, yang mengunduh font dari
  `fonts.googleapis.com` saat build. Ini disengaja: lingkungan sandbox
  tempat proyek ini pertama kali dibangun tidak memiliki akses ke domain
  Google Fonts, dan pendekatan self-hosted ini sekaligus lebih andal untuk
  produksi (tidak bergantung pada ketersediaan CDN pihak ketiga saat build).
  Tidak ada tindakan tambahan yang diperlukan — `npm install` sudah cukup.
- **Ingin memakai CLI shadcn/ui untuk menambah komponen baru:** proyek ini
  sudah menyertakan `components.json` yang valid, jadi `npx shadcn@latest add <komponen>`
  bisa langsung dipakai di lingkungan dengan akses internet penuh ke
  `ui.shadcn.com` (juga tidak dapat diakses dari sandbox awal proyek ini).
- **Halaman kosong / "Tidak ada hasil ditemukan" di mana-mana:** aplikasi
  tidak bisa menjangkau `services.nvd.nist.gov`. Coba jalankan
  `curl https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=1`
  langsung dari mesin/server yang sama untuk memastikan domain itu tidak
  diblokir firewall/proxy jaringan Anda. Fungsi-fungsi daftar di `lib/nvd.ts`
  sengaja tidak melempar error saat NVD gagal dihubungi (lihat
  `docs/API_INTEGRATION.md` §7) — jadi aplikasi tetap tampil, hanya
  datanya kosong. Cek log server (`console.error` dari `[lib/nvd]`) untuk
  pesan error yang lebih spesifik.
- **Kena limit permintaan NVD (`429` / pesan "Terlalu banyak permintaan"):**
  wajar tanpa `NVD_API_KEY` di bawah trafik yang cukup ramai (limitnya
  5 permintaan/30 detik). Tambahkan kunci gratis dari
  <https://nvd.nist.gov/developers/request-an-api-key> ke `.env.local`
  untuk naik ke 50/30 detik.
