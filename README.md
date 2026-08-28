# InfoCVE

Basis pengetahuan kerentanan siber (CVE) untuk pengguna Indonesia — sederhana,
cepat, dan ramah pemula.

InfoCVE adalah situs edukasi yang menampilkan data kerentanan keamanan (CVE)
langsung dari **NVD REST API v2.0 resmi**, lengkap dengan penjelasan Bahasa
Indonesia, skor CVSS yang diuraikan per-metrik, dan glosarium istilah
keamanan siber. Proyek ini murni edukasi: tidak ada login, basis data, atau
integrasi AI.

## Fitur

- **Beranda** — pencarian besar, CVE terbaru, CVE kritis & tingkat tinggi, vendor/produk terbaru, kategori keamanan, ajakan belajar di glosarium.
- **Cari CVE** (`/search`) — pencarian berdasarkan ID/vendor/produk/kata kunci, dengan filter tingkat keparahan, tahun, vendor, produk, CWE, rentang tanggal publikasi/pembaruan, dan pengurutan.
- **Detail CVE** (`/cve/[id]`) — ID, tingkat keparahan, skor & rincian CVSS, CWE, produk terdampak, deskripsi asli + penjelasan Indonesia, riwayat, referensi.
- **Glosarium** (`/glossary`) — 20 istilah keamanan siber dengan pencarian instan di sisi klien.
- **Tentang, Privasi, Syarat & Ketentuan** — halaman informasi standar.

## Tumpukan Teknologi

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4 · komponen
bergaya shadcn/ui (ditulis manual — lihat catatan di bawah) · Lucide React ·
React Server Components · **NVD REST API v2.0** untuk data CVE sungguhan.
Tanpa Express/NestJS/Laravel, tanpa basis data, sesuai batasan proyek.

## Mulai Cepat

```bash
npm install
cp .env.example .env.local
npm run dev
```

Aplikasi berjalan penuh tanpa `NVD_API_KEY` (dengan limit permintaan lebih
ketat). Untuk menambahkannya:

```bash
# .env.local
NVD_API_KEY=kunci_api_anda   # daftar gratis: https://nvd.nist.gov/developers/request-an-api-key
```

Lihat `docs/INSTALLATION.md` untuk detail lebih lanjut, `docs/DEPLOYMENT.md`
untuk panduan deploy ke Vercel, dan `docs/API_INTEGRATION.md` untuk
bagaimana integrasi NVD API bekerja secara rinci.

## CI/CD & Deployment

Proyek sudah dilengkapi dengan workflow GitHub Actions untuk menjaga kualitas
kode dan mempermudah update di masa depan:

- `ci.yml` — menjalankan `npm ci`, lint, type-check, unit test, build, lalu
  deploy otomatis ke Vercel untuk preview/production bila secret relevan sudah
  diatur.
- `sync.yml` — memanggil endpoint `/api/sync` secara berkala dan mengecek
  health endpoint `GET /api/health`.
- `deps.yml` — memeriksa dependency yang sudah usang dan menjalankan audit
  keamanan ringan.

Secret yang biasanya perlu disetel di GitHub repository settings:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `ADMIN_SECRET`
- `DEPLOY_URL` (opsional, dipakai workflow sinkronisasi harian)

Quick: menambahkan API key & menguji (lokal / Vercel)

1) Buat file `.env.local` di root (jangan commit). Contoh minimal:

```env
# .env.local (contoh)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NVD_API_KEY=masukkan_kunci_nvd_anda
GITHUB_TOKEN=masukkan_github_token_anda
ADMIN_SECRET=token_admin_yg_aman
INFOCVE_DATA_DIR=./data
```

2) Jalankan server lokal:

```bash
npm install
npm run dev
```

3) Uji health endpoint (setelah aplikasi hidup):

```bash
curl -sS http://localhost:3000/api/health | jq
```

4) Memicu sinkronisasi manual (pakai ADMIN_SECRET):

```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer <ADMIN_SECRET>" \
  -H "Content-Type: application/json" | jq
```

5) Di Vercel (produksi), tambahkan variabel environment yang sama via
   Project Settings → Environment Variables (`NVD_API_KEY`, `GITHUB_TOKEN`,
   `ADMIN_SECRET`, `NEXT_PUBLIC_SITE_URL`). Workflow GitHub Actions akan
   menggunakan `VERCEL_*` secrets untuk deploy bila sudah diset di repository.

Dengan konfigurasi ini, proses develop → review → deploy bisa dijalankan
secara konsisten tanpa perlu mengubah logika aplikasi lagi saat release baru.

## Arsitektur & Keputusan Desain

**Data NVD sungguhan, di balik lapisan layanan yang sama sejak awal.**
Seluruh data CVE berasal dari NVD REST API v2.0 resmi lewat `lib/nvd.ts`,
tapi tidak ada satu pun halaman/komponen yang memanggil `fetch()` atau
mengenal bentuk respons NVD secara langsung — semua memanggil fungsi
`async` di `lib/nvd.ts` (`getLatestCVEs`, `searchCVEs`, `getCVEById`, dst.,
persis sesuai daftar di spesifikasi proyek). Karena lapisan data selalu
`async` dan mengembalikan bentuk final sejak MVP pertama, mengganti mock
data dengan API sungguhan tidak mengubah satu pun halaman atau komponen —
lihat `docs/API_INTEGRATION.md` untuk arsitektur lengkapnya (pemecahan
`lib/nvd-*.ts`, strategi query, normalisasi, dan keterbatasan yang jujur
dari arsitektur tanpa basis data sendiri).

**Server Components secara default.** Hampir seluruh halaman dan komponen
adalah Server Component murni. Hanya enam bagian yang benar-benar butuh
`"use client"`: tombol salin CVE ID, toggle tema, menu mobile (Sheet),
filter glosarium langsung, accordion glosarium, dan tombol "Coba lagi" di
`<ErrorState>` — semuanya karena interaktivitas di sisi klien memang
diperlukan, bukan pilihan default.
Pencarian dan filter bekerja lewat `<form method="GET">` biasa yang
mengubah `searchParams`, sehingga tetap berfungsi tanpa JavaScript sekalipun.
Tidak ada Server Action yang dipakai — tidak ada mutasi data di MVP ini,
jadi tidak dibutuhkan.

**Dark mode tanpa `next-themes`.** Karena spesifikasi proyek membatasi
tumpukan teknologi secara eksplisit, mode gelap/terang ditulis manual:
skrip kecil yang memblokir render awal (`app/layout.tsx`) menentukan tema
sebelum tampilan pertama (mencegah flash tema yang salah), lalu
`hooks/use-theme.ts` menyinkronkan state React + `localStorage` setelahnya.

**shadcn/ui ditulis manual, bukan lewat CLI.** CLI resmi shadcn perlu
mengambil kode komponen dari `ui.shadcn.com`, yang tidak dapat diakses dari
lingkungan sandbox tempat proyek ini pertama kali dibangun (di luar daftar
domain yang diizinkan). Primitif di `components/ui/` (Button, Card, Input,
dst.) karena itu ditulis langsung mengikuti pola resmi shadcn/ui (Radix UI +
`class-variance-authority` + Tailwind) — hasil akhirnya identik dengan yang
dihasilkan CLI. `components.json` tetap disertakan dan valid, jadi
`npx shadcn@latest add <komponen>` bisa langsung dipakai di lingkungan
dengan akses internet penuh untuk menambah komponen baru.

**Judul dan kategori CVE tidak berasal langsung dari NVD.** NVD tidak
pernah memberi judul (hanya deskripsi) maupun taksonomi kategori
(`web-application`, `network`, dst. adalah konsep buatan aplikasi ini).
Keduanya diturunkan lewat heuristik yang didokumentasikan penuh di
`lib/nvd-normalize.ts` dan `docs/API_INTEGRATION.md` §6 — cukup baik untuk
kebutuhan navigasi/edukasi, tapi bukan klasifikasi otoritatif. Begitu pula
`descriptionId`: kamus istilah (`lib/dictionary.ts`) tidak bisa
menerjemahkan kalimat bebas, jadi yang ditampilkan adalah istilah-istilah
yang dikenali dari deskripsi asli, dijelaskan dalam Bahasa Indonesia secara
jujur — bukan terjemahan penuh (lihat §6 dokumen yang sama untuk alasan
lengkapnya, sesuai batasan "tanpa terjemahan AI" di spesifikasi awal).

**Tanpa foto/gambar eksternal.** Elemen visual berasal dari SVG inline,
gradien, dan pola titik CSS (lihat `styles/globals.css`), bukan foto stok —
selain menghindari isu lisensi, ini juga lebih sesuai untuk situs bertema
data teknis. Logo adalah SVG inline (`components/layout/logo.tsx`).
`next/image` tetap dikonfigurasi dan siap dipakai kapan pun gambar asli
(mis. tangkapan layar, foto tim di halaman Tentang) ditambahkan.

## Struktur Folder

Lihat `docs/INSTALLATION.md#struktur-folder`.

## Keterbatasan MVP yang Disengaja

Sesuai spesifikasi proyek: tidak ada login/akun, tidak ada basis data, tidak
ada integrasi AI, tidak ada iklan/analitik/notifikasi. Selain itu, beberapa
penyederhanaan tambahan yang diambil demi menjaga MVP tetap fokus:

- Gambar Open Graph dinamis hanya dibuat untuk halaman umum, belum per-CVE.
- Filter vendor/produk/tahun/CWE pada `/search` membatasi satu nilai
  terpilih per kategori (bukan multi-pilih) — `searchCVEs()` di lapisan
  data sudah mendukung array, jadi UI multi-pilih bisa ditambahkan kapan
  pun tanpa mengubah `lib/nvd.ts`.
- Angka vendor/produk/kategori/tahun/statistik di beranda berasal dari
  sampel 2.000 CVE terbaru (120 hari terakhir), bukan seluruh sejarah NVD
  — NVD tidak menyediakan endpoint agregasi, dan menyimpan salinan penuh
  butuh basis data sendiri yang dilarang spesifikasi. Detail di
  `docs/API_INTEGRATION.md` §5.
- Pencarian dengan kombinasi filter yang tidak bisa dipetakan langsung ke
  parameter NVD (mis. beberapa tingkat keparahan sekaligus, atau filter
  kategori) mengambil satu batch 200 hasil lalu menyaringnya di memori —
  akurat untuk batch tersebut, bukan pencarian menyeluruh atas 200.000+
  CVE NVD. Detail di `docs/API_INTEGRATION.md` §4.
- Kategori dan judul CVE adalah hasil heuristik (lihat README bagian
  Arsitektur), bukan data resmi dari NVD.

## Riwayat Perubahan

### Pengerasan produksi (production-hardening pass)

Putaran audit lain, kali ini berfokus pada keamanan, performa, dan detail
yang baru terasa penting setelah data sungguhan mengalir (bukan lagi 14
entri terkontrol). Temuan signifikan:

- **Kontras warna tingkat keparahan di mode terang gagal WCAG AA** — dihitung
  langsung (bukan diperkirakan): kombinasi teks-di-atas-tint yang aman di
  mode gelap (4.65–10.05:1) ternyata gagal di mode terang (1.36–3.00:1,
  bahkan untuk ikon yang ambang batasnya lebih longgar). Diperbaiki dengan
  token teks terpisah per tema (`--color-severity-*-fg`) yang tetap
  sehue tapi digelapkan khusus untuk mode terang, diverifikasi ulang hingga
  5.20–7.81:1.
- **`next.config.ts` masih benar-benar kosong** — tidak ada header
  keamanan sama sekali. Ditambahkan CSP, `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, dan
  `poweredByHeader: false`.
- **Celah injeksi JSON-LD** — `JSON.stringify` tidak meng-escape `<`,
  sehingga deskripsi CVE (berasal dari API eksternal) yang secara teoritis
  memuat `</script>` bisa memutus tag script lebih awal. Diperbaiki dengan
  serializer yang meng-escape karakter tersebut.
- **4 kerentanan berseverity tinggi** pada `postcss`/`sharp`/`brace-expansion`
  (transitif lewat Next.js) — diperbaiki dengan menaikkan Next.js ke 16.3.0
  (patch aman, diverifikasi ulang lewat build+lint+type-check+regresi
  runtime penuh) dan `npm audit fix`. 0 kerentanan tersisa.
- Tag `<meta>` OpenGraph/Twitter di halaman statis (Tentang, Privasi,
  Syarat, Glosarium, Cari) diam-diam mewarisi judul/deskripsi beranda
  alih-alih miliknya sendiri — dibuatkan `utils/metadata.ts` sebagai
  helper bersama, sekaligus menghilangkan duplikasi.
- `noUncheckedIndexedAccess` diaktifkan di `tsconfig.json`, menemukan 2
  akses array yang secara teori bisa `undefined`; keduanya diperbaiki
  tanpa non-null assertion.
- Kode mati dibersihkan: 3 fungsi tak terpakai di `lib/dictionary.ts`
  (duplikat konsep dari `utils/severity.ts`), `severityRank`,
  `SeverityLegend`, `ListRowSkeleton`, folder `public/og/` yang kosong,
  serta 5 pemakaian `!` non-null assertion diganti dengan penyempitan tipe
  yang semestinya. Duplikasi `.toFixed(1)` di dua komponen disatukan
  kembali ke `formatCvssScore()` yang sudah ada tapi tidak dipakai.
- Favicon generik bawaan `create-next-app` diganti dengan ikon bermerek
  (`app/icon.svg` + `favicon.ico` beresolusi ganda, dibuat dari bentuk
  yang sama dengan `<Logo>` yang sudah ada).
- Edge case paginasi: `?page=2.5` atau `?page=-3` pada URL kini di-floor
  dan di-clamp dengan benar di titik parsing maupun di `lib/nvd.ts`
  sendiri, alih-alih diam-diam menghasilkan nomor halaman pecahan.

### Integrasi NVD REST API v2.0 (menggantikan data mock)

Seluruh `lib/mock-data.ts` dan data tiruan lainnya dihapus. `lib/nvd.ts`
sekarang memanggil NVD REST API v2.0 resmi sungguhan, dipecah menjadi empat
berkas (`lib/nvd-types.ts`, `lib/nvd-client.ts`, `lib/cwe-catalog.ts`,
`lib/nvd-normalize.ts`) dengan `lib/nvd.ts` sebagai satu-satunya titik
masuk publik — signature dan nama setiap fungsi yang sudah dipakai halaman
tetap sama, jadi tidak ada halaman/komponen yang perlu mengubah cara
memanggilnya. Fungsi baru sesuai permintaan: `getHighCVEs()`,
`getCVEsByProduct()`, `getRecentCVEs()` (berdasarkan tanggal *pembaruan*
terakhir, melengkapi `getLatestCVEs()` yang berdasarkan tanggal publikasi).

Highlight teknis: `AbortController` per percobaan + retry backoff
eksponensial (melewati 400/403/404, mengulang 429/5xx/timeout/jaringan,
menghormati header `Retry-After`); validasi bentuk respons; normalisasi
penuh termasuk fallback CVSS v3.1→v3.0→v2, parsing CPE untuk vendor/produk,
katalog CWE statis, dan heuristik kategori; caching lewat `fetch` Next.js
(`revalidate` 1–6 jam tergantung jenis data) sebagai pertahanan utama
terhadap rate limit; setiap fungsi bertipe daftar sengaja tidak pernah
`throw` (gagal → hasil kosong, bukan halaman rusak — termasuk saat
`next build` mencoba prerendering statis), sementara `getCVEById` tetap
membedakan "dipastikan tidak ada" dari "gagal terhubung". Diverifikasi
lewat build/lint/type-check bersih, pengujian unit manual terhadap data
berbentuk NVD sungguhan (menemukan dan memperbaiki bug nyata pada heuristik
kategori — lihat `docs/API_INTEGRATION.md`), dan pengujian end-to-end atas
seluruh rute termasuk skenario NVD tidak terjangkau/`NVD_API_KEY` kosong.

Detail arsitektur, keterbatasan yang jujur (sampel facet, pencarian
kombinasi filter kompleks, dst.), dan catatan tentang perilaku Next.js yang
ditemukan selama pengujian ada di `docs/API_INTEGRATION.md`.

### Audit & refactor menyeluruh

Proyek ini sempat melalui satu putaran audit kode menyeluruh (build, lint,
type-check ketat, dan tinjauan manual per komponen) setelah versi MVP awal
selesai. Arsitektur, gaya kode, dan struktur folder dipertahankan; hanya
perbaikan yang benar-benar diperlukan yang dilakukan:

**Fitur yang dilengkapi**
- Filter rentang tanggal publikasi & pembaruan pada `/search` — sebelumnya
  `publishedDate`/`lastModifiedDate` hanya bisa dipakai untuk **mengurutkan**
  hasil, padahal spesifikasi awal juga memintanya sebagai filter. Sekarang
  `searchCVEs()` menerima `publishedFrom`/`publishedTo`/`modifiedFrom`/`modifiedTo`,
  dengan validasi format tanggal agar URL yang dimanipulasi manual tidak
  membuat filter gagal secara diam-diam.

**Aksesibilitas**
- Grup checkbox tingkat keparahan kini memakai `<legend>` yang semestinya,
  bukan `<label>` mengambang di dalam `<fieldset>`.
- Landmark `<nav>` utama (desktop & mobile) diberi `aria-label` agar mudah
  dibedakan dari nav breadcrumb/paginasi saat dijelajahi lewat pembaca layar.
- Ticker CVE di beranda kini benar-benar dekoratif: `aria-hidden`, tautan
  duplikatnya dikeluarkan dari urutan Tab (`tabIndex={-1}`), dan animasinya
  berhenti saat kursor/fokus berada di atasnya.

**Pembersihan kode**
- Menghapus `sortBySeverityThenDate()` dan re-export tipe `Severity` di
  `lib/nvd.ts` — keduanya tidak dipakai di mana pun.
- Menghapus intersection tipe `& { category }` yang berlebihan pada
  `parseParams()` di `app/search/page.tsx` (`category` sudah menjadi bagian
  dari `SearchCVEParams`).
- Menyamakan token focus ring (`ring-ring`, bukan `ring-accent`) pada
  `<Button>` agar konsisten dengan komponen interaktif lain.
- `key` pada daftar "Produk Terdampak" di halaman detail CVE diganti dari
  indeks array menjadi `vendor-produk` yang stabil.
- URL paginasi tidak lagi menyisipkan `?q=` kosong saat kolom pencarian
  tidak diisi.
- `package.json` kini mematok `engines.node`.

Detail lengkap tiap perubahan ada di riwayat commit / percakapan; ringkasan
di atas hanya mencatat *apa* yang berubah dan *mengapa*.

## Lisensi

MIT — lihat `LICENSE`.
